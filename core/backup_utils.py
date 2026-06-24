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
        
        # Primary DB configuration (the source for backups, as defined in settings.py)
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

        # Synced tables list in foreign-key dependency order
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
    
    def test_backup_connection(self):
        """Test connection to the backup database."""
        try:
            conn = psycopg2.connect(**self.backup_config)
            conn.close()
            return True, "Connected to Backup DB"
        except Exception as e:
            return False, str(e)
    
    def test_primary_connection(self):
        """Test connection to the primary database."""
        try:
            conn = psycopg2.connect(**self.primary_config)
            conn.close()
            return True, "Connected to Primary DB"
        except Exception as e:
            return False, str(e)
    
    def get_primary_db_counts(self):
        """Get record counts from the primary database."""
        try:
            conn = psycopg2.connect(**self.primary_config)
            cursor = conn.cursor()
            
            # Try to get counts, handle missing tables gracefully
            counts = {'documents': 0, 'archives': 0, 'audit_logs': 0, 'users': 0, 'total': 0}
            
            try:
                cursor.execute("SELECT COUNT(*) FROM core_legislativedocument")
                counts['documents'] = cursor.fetchone()[0]
            except Exception:
                counts['documents'] = 0
                
            try:
                cursor.execute("SELECT COUNT(*) FROM core_archiveddocument")
                counts['archives'] = cursor.fetchone()[0]
            except Exception:
                counts['archives'] = 0
                
            try:
                cursor.execute("SELECT COUNT(*) FROM core_auditlog")
                counts['audit_logs'] = cursor.fetchone()[0]
            except Exception:
                counts['audit_logs'] = 0
                
            try:
                cursor.execute("SELECT COUNT(*) FROM auth_user")
                counts['users'] = cursor.fetchone()[0]
            except Exception:
                counts['users'] = 0
            
            # Calculate total records sum dynamically from all synced tables
            total_sum = 0
            for table in self.tables:
                try:
                    cursor.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table)))
                    total_sum += cursor.fetchone()[0]
                except Exception:
                    pass
            counts['total'] = total_sum
            
            cursor.close()
            conn.close()
            
            return counts
        except Exception as e:
            logger.error(f"Error getting counts: {e}")
            return {'documents': 0, 'archives': 0, 'audit_logs': 0, 'users': 0, 'total': 0}
    
    def sync_to_backup(self, backup_log_id=None):
        """Sync all tables from the primary DB to the backup DB using a non-destructive upsert merge."""
        from core.models import BackupLog
        
        primary_conn = None
        backup_conn = None
        
        try:
            # Test connections first
            primary_ok, primary_msg = self.test_primary_connection()
            if not primary_ok:
                raise Exception(f"Cannot connect to primary DB: {primary_msg}")
            
            backup_ok, backup_msg = self.test_backup_connection()
            if not backup_ok:
                raise Exception(f"Cannot connect to backup DB: {backup_msg}")
            
            counts = self.get_primary_db_counts()
            
            # Open connections once
            primary_conn = psycopg2.connect(**self.primary_config)
            backup_conn = psycopg2.connect(**self.backup_config)
            primary_cursor = primary_conn.cursor()
            backup_cursor = backup_conn.cursor()
            
            total_synced = 0
            missing_tables = []
            
            # Process each table
            for table in self.tables:
                try:
                    # Check if table exists in primary DB
                    primary_cursor.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' AND table_name = %s
                        )
                    """, (table,))
                    
                    if not primary_cursor.fetchone()[0]:
                        continue
                    
                    primary_cursor.execute(sql.SQL("SELECT * FROM {}").format(sql.Identifier(table)))
                    rows = primary_cursor.fetchall()
                    
                    if rows:
                        col_names = [desc[0] for desc in primary_cursor.description]
                        
                        # Check if table exists in backup DB
                        backup_cursor.execute("""
                            SELECT EXISTS (
                                SELECT FROM information_schema.tables 
                                WHERE table_schema = 'public' AND table_name = %s
                            )
                        """, (table,))
                        
                        if not backup_cursor.fetchone()[0]:
                            missing_tables.append(table)
                            logger.warning(f"Destination table '{table}' does not exist in backup DB. Skipping sync. Please run migrations on the backup database.")
                            continue
                        
                        # Build upsert query
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
                            backup_cursor.execute(upsert_query, row)
                        
                        # Reset sequence on backup side to prevent IntegrityError on new inserts
                        try:
                            if 'id' in col_names:
                                seq_query = sql.SQL(
                                    "SELECT setval(pg_get_serial_sequence(%s, 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM {}"
                                ).format(sql.Identifier(table))
                                backup_cursor.execute(seq_query, [table])
                        except Exception as seq_e:
                            logger.error(f"Sequence reset failed for {table} on backup DB: {seq_e}")

                        total_synced += len(rows)
                        print(f"Synced {len(rows)} records from {table}")
                
                except Exception as e:
                    print(f"Error syncing table {table}: {e}")
                    logger.error(f"Error syncing table {table}: {e}")
            
            if missing_tables:
                raise Exception(f"Backup DB is missing tables: {', '.join(missing_tables)}. Please run 'python manage.py migrate' on the backup database first.")
            
            backup_conn.commit()
            
            if backup_log_id:
                BackupLog.objects.filter(id=backup_log_id).update(
                    records_synced=total_synced,
                    documents_synced=counts.get('documents', 0),
                    archives_synced=counts.get('archives', 0),
                    audit_logs_synced=counts.get('audit_logs', 0),
                    users_synced=counts.get('users', 0),
                    status='success',
                    completed_at=timezone.now()
                )
            
            return True, total_synced, counts
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            if backup_log_id:
                BackupLog.objects.filter(id=backup_log_id).update(
                    status='failed',
                    error_message=str(e),
                    completed_at=timezone.now()
                )
            return False, 0, {}

        finally:
            if primary_conn: primary_conn.close()
            if backup_conn: backup_conn.close()

    def restore_from_backup(self, backup_log_id=None):
        """Restore (Pull & Merge) all tables from the backup DB to the primary DB."""
        from core.models import BackupLog
        
        primary_conn = None
        backup_conn = None

        try:
            backup_conn = psycopg2.connect(**self.backup_config)
            primary_conn = psycopg2.connect(**self.primary_config)
            backup_cursor = backup_conn.cursor()
            primary_cursor = primary_conn.cursor()
            
            total_restored = 0
            
            for table in self.tables:
                try:
                    # Check if table exists in backup DB
                    backup_cursor.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' AND table_name = %s
                        )
                    """, (table,))
                    
                    if not backup_cursor.fetchone()[0]:
                        continue
                    
                    backup_cursor.execute(sql.SQL("SELECT * FROM {}").format(sql.Identifier(table)))
                    rows = backup_cursor.fetchall()
                    
                    if rows:
                        col_names = [desc[0] for desc in backup_cursor.description]
                        
                        # Check if table exists in primary DB
                        primary_cursor.execute("""
                            SELECT EXISTS (
                                SELECT FROM information_schema.tables 
                                WHERE table_schema = 'public' AND table_name = %s
                            )
                        """, (table,))
                        
                        if not primary_cursor.fetchone()[0]:
                            logger.warning(f"Destination table '{table}' does not exist in the primary DB. Skipping restore for this table.")
                            continue
                        
                        # Build upsert query
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
                            primary_cursor.execute(upsert_query, row)
                        
                        # Reset primary DB sequence to prevent IntegrityError on new inserts
                        try:
                            if 'id' in col_names:
                                seq_query = sql.SQL(
                                    "SELECT setval(pg_get_serial_sequence(%s, 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM {}"
                                ).format(sql.Identifier(table))
                                primary_cursor.execute(seq_query, [table])
                        except Exception as seq_e:
                            logger.error(f"Sequence reset failed for {table} on primary DB: {seq_e}")

                        total_restored += len(rows)
                        print(f"Restored {len(rows)} records to {table}")

                except Exception as e:
                    print(f"Error restoring table {table}: {e}")
                    logger.error(f"Error restoring table {table}: {e}")
            
            primary_conn.commit()
            
            counts = self.get_primary_db_counts()
            
            if backup_log_id:
                BackupLog.objects.filter(id=backup_log_id).update(
                    records_synced=total_restored,
                    documents_synced=counts.get('documents', 0),
                    archives_synced=counts.get('archives', 0),
                    audit_logs_synced=counts.get('audit_logs', 0),
                    users_synced=counts.get('users', 0),
                    status='success',
                    completed_at=timezone.now()
                )
            
            return True, total_restored, counts
            
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            if backup_log_id:
                BackupLog.objects.filter(id=backup_log_id).update(
                    status='failed',
                    error_message=str(e),
                    completed_at=timezone.now()
                )
            return False, 0, {}
        
        finally:
            if primary_conn: primary_conn.close()
            if backup_conn: backup_conn.close()