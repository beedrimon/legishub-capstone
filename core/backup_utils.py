import os
import psycopg2
from psycopg2 import sql
from django.conf import settings
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

class SupabaseBackup:
    """Handle backup and sync to Supabase cloud"""

    def __init__(self):
        # Backup DB configuration (the destination for backups)
        self.backup_config = {
            'dbname': os.getenv('SUPABASE_DB_NAME', 'postgres'),
            'user': os.getenv('SUPABASE_DB_USER', ''),
            'password': os.getenv('SUPABASE_DB_PASSWORD', ''),
            'host': os.getenv('SUPABASE_DB_HOST', ''),
            'port': int(os.getenv('SUPABASE_DB_PORT', '6543')),
            'sslmode': os.getenv('SUPABASE_DB_SSL_MODE', 'require'),
        }

        # Primary DB configuration (the source for backups)
        default_db = settings.DATABASES['default']
        self.primary_config = {
            'dbname': default_db.get('NAME', ''),
            'user': default_db.get('USER', ''),
            'password': default_db.get('PASSWORD', ''),
            'host': default_db.get('HOST', ''),
            'port': default_db.get('PORT', '5432'),
        }
        if 'OPTIONS' in default_db and 'sslmode' in default_db['OPTIONS']:
            self.primary_config['sslmode'] = default_db['OPTIONS']['sslmode']

        # Tables in foreign‑key dependency order (parents first)
        self.tables = [
            'auth_user',
            'system_settings',
            'core_archivefolder',
            'core_legislativedocument',
            'core_archiveddocument',
            'core_vetoeddocument',
            'document_progress',
            'archived_document_progress',
            'support_tickets',
            'core_auditlog'
        ]

        # Natural unique keys – used for conflict resolution
        self.unique_keys = {
            'auth_user': 'username',
            'system_settings': 'key',
            'core_archivefolder': 'name',
            'core_legislativedocument': 'document_number',
            'core_archiveddocument': 'archive_id',
            'core_vetoeddocument': 'document_number',
            'support_tickets': 'ticket_number',
        }

        # For each child table, define which columns are foreign keys
        # and which parent table they reference.
        self.foreign_key_mappings = {
            'document_progress': {
                'document_id': 'core_legislativedocument',
                'created_by_id': 'auth_user',
            },
            'archived_document_progress': {
                'archived_document_id': 'core_archiveddocument',
                'created_by_id': 'auth_user',
            },
            'support_tickets': {
                'user_id': 'auth_user',
            },
            'core_auditlog': {
                'user_id': 'auth_user',
                'document_id': 'core_legislativedocument',
            },
        }

    def test_backup_connection(self):
        try:
            conn = psycopg2.connect(**self.backup_config)
            conn.close()
            return True, "Connected to Backup DB"
        except Exception as e:
            return False, str(e)

    def test_primary_connection(self):
        try:
            conn = psycopg2.connect(**self.primary_config)
            conn.close()
            return True, "Connected to Primary DB"
        except Exception as e:
            return False, str(e)

    def get_primary_db_counts(self):
        try:
            conn = psycopg2.connect(**self.primary_config)
            cursor = conn.cursor()
            counts = {'documents': 0, 'archives': 0, 'audit_logs': 0, 'users': 0, 'total': 0}
            try:
                cursor.execute("SELECT COUNT(*) FROM core_legislativedocument")
                counts['documents'] = cursor.fetchone()[0]
            except Exception:
                pass
            try:
                cursor.execute("SELECT COUNT(*) FROM core_archiveddocument")
                counts['archives'] = cursor.fetchone()[0]
            except Exception:
                pass
            try:
                cursor.execute("SELECT COUNT(*) FROM core_auditlog")
                counts['audit_logs'] = cursor.fetchone()[0]
            except Exception:
                pass
            try:
                cursor.execute("SELECT COUNT(*) FROM auth_user")
                counts['users'] = cursor.fetchone()[0]
            except Exception:
                pass
            total = 0
            for table in self.tables:
                try:
                    cursor.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table)))
                    total += cursor.fetchone()[0]
                except Exception:
                    pass
            counts['total'] = total
            cursor.close()
            conn.close()
            return counts
        except Exception as e:
            logger.error(f"Error getting counts: {e}")
            return {'documents': 0, 'archives': 0, 'audit_logs': 0, 'users': 0, 'total': 0}

    def _disable_triggers(self, cursor):
        try:
            cursor.execute("SET session_replication_role = replica;")
            return True
        except Exception:
            return False

    def _enable_triggers(self, cursor):
        try:
            cursor.execute("SET session_replication_role = DEFAULT;")
            return True
        except Exception:
            return False

    def _merge_tables(self, source_conn, dest_conn, direction='push', backup_log_id=None):
        """
        Core merge logic: upsert from source to destination using natural keys and foreign-key mapping.
        direction: 'push' (local -> cloud) or 'pull' (cloud -> local)
        """
        from core.models import BackupLog

        source_conn.autocommit = False
        dest_conn.autocommit = False
        source_cursor = source_conn.cursor()
        dest_cursor = dest_conn.cursor()

        # Try to disable triggers on destination
        self._disable_triggers(dest_cursor)

        # Dictionary to map source IDs to destination IDs for parent tables
        id_mapping = {}  # table_name -> {source_id: dest_id}

        total_processed = 0
        errors = []

        for table in self.tables:
            try:
                # Check if table exists in source
                source_cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = %s
                    )
                """, (table,))
                if not source_cursor.fetchone()[0]:
                    continue

                # Check if table exists in destination
                dest_cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = %s
                    )
                """, (table,))
                if not dest_cursor.fetchone()[0]:
                    errors.append(f"Table '{table}' missing in destination DB. Skipping.")
                    continue

                # Fetch all rows from source
                source_cursor.execute(sql.SQL("SELECT * FROM {}").format(sql.Identifier(table)))
                rows = source_cursor.fetchall()
                if not rows:
                    continue

                col_names = [desc[0] for desc in source_cursor.description]
                unique_key = self.unique_keys.get(table)

                if unique_key:
                    # Table has a natural key – upsert using that
                    if unique_key not in col_names:
                        errors.append(f"Unique key '{unique_key}' not in table {table}. Skipping.")
                        continue

                    update_cols = [col for col in col_names if col != unique_key and col != 'id']
                    placeholders = ','.join(['%s'] * len(col_names))
                    update_set = sql.SQL(', ').join([
                        sql.SQL("{} = EXCLUDED.{}").format(sql.Identifier(col), sql.Identifier(col))
                        for col in update_cols
                    ])
                    upsert_query = sql.SQL(
                        "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT ({}) DO UPDATE SET {}"
                    ).format(
                        sql.Identifier(table),
                        sql.SQL(',').join(map(sql.Identifier, col_names)),
                        sql.SQL(placeholders),
                        sql.Identifier(unique_key),
                        update_set
                    )

                    mapping = {}
                    for row in rows:
                        dest_cursor.execute(upsert_query, row)
                        # Get the destination ID
                        unique_val = row[col_names.index(unique_key)]
                        dest_cursor.execute(
                            sql.SQL("SELECT id FROM {} WHERE {} = %s").format(
                                sql.Identifier(table), sql.Identifier(unique_key)
                            ),
                            (unique_val,)
                        )
                        dest_id = dest_cursor.fetchone()[0]
                        src_id = row[col_names.index('id')]
                        mapping[src_id] = dest_id

                    id_mapping[table] = mapping
                    total_processed += len(rows)
                    dest_conn.commit()
                    logger.info(f"{direction.capitalize()}: Upserted {len(rows)} records by {unique_key} to {table}")

                else:
                    # Child table – need to map foreign keys
                    fk_map = self.foreign_key_mappings.get(table, {})
                    if not fk_map:
                        # No foreign keys – fallback to ID‑based upsert
                        update_cols = [col for col in col_names if col != 'id']
                        placeholders = ','.join(['%s'] * len(col_names))
                        if update_cols:
                            update_set = sql.SQL(', ').join([
                                sql.SQL("{} = EXCLUDED.{}").format(sql.Identifier(col), sql.Identifier(col))
                                for col in update_cols
                            ])
                            upsert_query = sql.SQL(
                                "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT (id) DO UPDATE SET {}"
                            ).format(
                                sql.Identifier(table),
                                sql.SQL(',').join(map(sql.Identifier, col_names)),
                                sql.SQL(placeholders),
                                update_set
                            )
                        else:
                            upsert_query = sql.SQL(
                                "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT (id) DO NOTHING"
                            ).format(
                                sql.Identifier(table),
                                sql.SQL(',').join(map(sql.Identifier, col_names)),
                                sql.SQL(placeholders)
                            )
                        for row in rows:
                            dest_cursor.execute(upsert_query, row)
                        total_processed += len(rows)
                        dest_conn.commit()
                        logger.info(f"{direction.capitalize()}: Upserted {len(rows)} records by ID to {table}")
                        continue

                    # Rewrite foreign keys using id_mapping
                    for row in rows:
                        row_list = list(row)
                        # Map each foreign key
                        for fk_col, parent_table in fk_map.items():
                            if parent_table not in id_mapping:
                                # Parent not yet synced – skip this row
                                logger.warning(f"Parent table {parent_table} not synced yet. Skipping row in {table}")
                                continue
                            src_fk_val = row_list[col_names.index(fk_col)]
                            if src_fk_val is not None and src_fk_val in id_mapping[parent_table]:
                                row_list[col_names.index(fk_col)] = id_mapping[parent_table][src_fk_val]
                            # else: keep as is (may cause FK error if not present)

                        # Upsert using ID
                        update_cols = [col for col in col_names if col != 'id']
                        placeholders = ','.join(['%s'] * len(col_names))
                        if update_cols:
                            update_set = sql.SQL(', ').join([
                                sql.SQL("{} = EXCLUDED.{}").format(sql.Identifier(col), sql.Identifier(col))
                                for col in update_cols
                            ])
                            upsert_query = sql.SQL(
                                "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT (id) DO UPDATE SET {}"
                            ).format(
                                sql.Identifier(table),
                                sql.SQL(',').join(map(sql.Identifier, col_names)),
                                sql.SQL(placeholders),
                                update_set
                            )
                        else:
                            upsert_query = sql.SQL(
                                "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT (id) DO NOTHING"
                            ).format(
                                sql.Identifier(table),
                                sql.SQL(',').join(map(sql.Identifier, col_names)),
                                sql.SQL(placeholders)
                            )
                        dest_cursor.execute(upsert_query, row_list)
                        total_processed += 1
                    dest_conn.commit()
                    logger.info(f"{direction.capitalize()}: Synced {len(rows)} records with FK mapping to {table}")

            except Exception as e:
                dest_conn.rollback()
                err_msg = f"{table}: {str(e)}"
                logger.error(err_msg)
                errors.append(err_msg)

        # Re-enable triggers
        self._enable_triggers(dest_cursor)
        dest_conn.commit()

        if errors:
            raise Exception(f"Sync failed for some tables: {' | '.join(errors)}")

        # Get counts (for logging only)
        counts = self.get_primary_db_counts() if direction == 'push' else {'total': total_processed}

        if backup_log_id:
            BackupLog.objects.filter(id=backup_log_id).update(
                records_synced=total_processed,
                documents_synced=counts.get('documents', 0),
                archives_synced=counts.get('archives', 0),
                audit_logs_synced=counts.get('audit_logs', 0),
                users_synced=counts.get('users', 0),
                status='success',
                completed_at=timezone.now()
            )

        return True, total_processed, counts

    def sync_to_backup(self, backup_log_id=None):
        """Push: Merge local data into cloud (upsert with natural keys, map foreign keys)."""
        primary_conn = None
        backup_conn = None

        try:
            primary_ok, primary_msg = self.test_primary_connection()
            if not primary_ok:
                raise Exception(f"Cannot connect to primary DB: {primary_msg}")

            backup_ok, backup_msg = self.test_backup_connection()
            if not backup_ok:
                raise Exception(f"Cannot connect to backup DB: {backup_msg}")

            primary_conn = psycopg2.connect(**self.primary_config)
            backup_conn = psycopg2.connect(**self.backup_config)

            return self._merge_tables(primary_conn, backup_conn, direction='push', backup_log_id=backup_log_id)

        except Exception as e:
            logger.error(f"Push failed: {e}")
            if backup_log_id:
                from core.models import BackupLog
                BackupLog.objects.filter(id=backup_log_id).update(
                    status='failed',
                    error_message=str(e),
                    completed_at=timezone.now()
                )
            return False, 0, {}

        finally:
            if primary_conn:
                primary_conn.close()
            if backup_conn:
                backup_conn.close()

    def restore_from_backup(self, backup_log_id=None):
        """Pull: Merge cloud data into local database (upsert with natural keys, map foreign keys)."""
        primary_conn = None
        backup_conn = None

        try:
            backup_ok, backup_msg = self.test_backup_connection()
            if not backup_ok:
                raise Exception(f"Cannot connect to backup DB: {backup_msg}")

            primary_ok, primary_msg = self.test_primary_connection()
            if not primary_ok:
                raise Exception(f"Cannot connect to primary DB: {primary_msg}")

            backup_conn = psycopg2.connect(**self.backup_config)
            primary_conn = psycopg2.connect(**self.primary_config)

            return self._merge_tables(backup_conn, primary_conn, direction='pull', backup_log_id=backup_log_id)

        except Exception as e:
            logger.error(f"Pull failed: {e}")
            if backup_log_id:
                from core.models import BackupLog
                BackupLog.objects.filter(id=backup_log_id).update(
                    status='failed',
                    error_message=str(e),
                    completed_at=timezone.now()
                )
            return False, 0, {}

        finally:
            if primary_conn:
                primary_conn.close()
            if backup_conn:
                backup_conn.close()