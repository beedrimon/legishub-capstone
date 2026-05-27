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
        # Supabase cloud configuration
        self.supabase_config = {
            'dbname': os.getenv('SUPABASE_DB_NAME', 'postgres'),
            'user': os.getenv('SUPABASE_DB_USER', ''),
            'password': os.getenv('SUPABASE_DB_PASSWORD', ''),
            'host': os.getenv('SUPABASE_DB_HOST', ''),
            'port': int(os.getenv('SUPABASE_DB_PORT', '6543')),
        }
        
        # Local PostgreSQL configuration
        self.local_config = {
            'dbname': settings.DATABASES['default']['NAME'],
            'user': settings.DATABASES['default']['USER'],
            'password': settings.DATABASES['default']['PASSWORD'],
            'host': settings.DATABASES['default']['HOST'],
            'port': settings.DATABASES['default']['PORT'],
        }
    
    def test_connection(self):
        """Test connection to Supabase"""
        try:
            conn = psycopg2.connect(**self.supabase_config)
            conn.close()
            return True, "Connected to Supabase"
        except Exception as e:
            return False, str(e)
    
    def test_local_connection(self):
        """Test connection to local database"""
        try:
            conn = psycopg2.connect(**self.local_config)
            conn.close()
            return True, "Connected to local database"
        except Exception as e:
            return False, str(e)
    
    def get_local_counts(self):
        """Get record counts from local database"""
        try:
            conn = psycopg2.connect(**self.local_config)
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
            
            counts['total'] = counts['documents'] + counts['archives'] + counts['audit_logs'] + counts['users']
            
            cursor.close()
            conn.close()
            
            return counts
        except Exception as e:
            logger.error(f"Error getting counts: {e}")
            return {'documents': 0, 'archives': 0, 'audit_logs': 0, 'users': 0, 'total': 0}
    
    def sync_all_tables(self, backup_log_id=None):
        """Sync all tables to Supabase"""
        from core.models import BackupLog
        
        try:
            # First test local connection
            local_ok, local_msg = self.test_local_connection()
            if not local_ok:
                raise Exception(f"Cannot connect to local database: {local_msg}")
            
            # Then test Supabase connection
            supabase_ok, supabase_msg = self.test_connection()
            if not supabase_ok:
                raise Exception(f"Cannot connect to Supabase: {supabase_msg}")
            
            counts = self.get_local_counts()
            
            supabase_conn = psycopg2.connect(**self.supabase_config)
            supabase_cursor = supabase_conn.cursor()
            
            # TABLES TO SYNC
            tables = [
                'auth_user',
                'core_legislativedocument', 
                'core_archiveddocument', 
                'core_auditlog'
            ]
            total_synced = 0
            
            for table in tables:
                try:
                    # Check if table exists locally
                    local_conn = psycopg2.connect(**self.local_config)
                    local_cursor = local_conn.cursor()
                    local_cursor.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' AND table_name = %s
                        )
                    """, (table,))
                    
                    if not local_cursor.fetchone()[0]:
                        local_cursor.close()
                        local_conn.close()
                        continue
                    
                    local_cursor.execute(sql.SQL("SELECT * FROM {}").format(sql.Identifier(table)))
                    rows = local_cursor.fetchall()
                    
                    if rows:
                        col_names = [desc[0] for desc in local_cursor.description]
                        
                        # Check if table exists in Supabase
                        supabase_cursor.execute("""
                            SELECT EXISTS (
                                SELECT FROM information_schema.tables 
                                WHERE table_schema = 'public' AND table_name = %s
                            )
                        """, (table,))
                        
                        if supabase_cursor.fetchone()[0]:
                            supabase_cursor.execute(sql.SQL("TRUNCATE TABLE {} CASCADE").format(sql.Identifier(table)))
                            
                            for row in rows:
                                placeholders = ','.join(['%s'] * len(row))
                                insert_query = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                                    sql.Identifier(table),
                                    sql.SQL(',').join(map(sql.Identifier, col_names)),
                                    sql.SQL(placeholders)
                                )
                                supabase_cursor.execute(insert_query, row)
                            
                            total_synced += len(rows)
                            print(f"Synced {len(rows)} records from {table}")
                    
                    local_cursor.close()
                    local_conn.close()
                except Exception as e:
                    print(f"Error syncing table {table}: {e}")
                    logger.error(f"Error syncing table {table}: {e}")
            
            supabase_conn.commit()
            supabase_cursor.close()
            supabase_conn.close()
            
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
            logger.error(f"Sync error: {e}")
            if backup_log_id:
                from core.models import BackupLog
                BackupLog.objects.filter(id=backup_log_id).update(
                    status='failed',
                    error_message=str(e),
                    completed_at=timezone.now()
                )
            return False, 0, {}

    def restore_from_supabase(self, backup_log_id=None):
        """Restore all tables from Supabase to local database"""
        from core.models import BackupLog
        
        try:
            supabase_conn = psycopg2.connect(**self.supabase_config)
            supabase_cursor = supabase_conn.cursor()
            
            tables = [
                'auth_user',
                'core_legislativedocument', 
                'core_archiveddocument', 
                'core_auditlog'
            ]
            total_restored = 0
            
            for table in tables:
                try:
                    # Check if table exists in Supabase
                    supabase_cursor.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' AND table_name = %s
                        )
                    """, (table,))
                    
                    if not supabase_cursor.fetchone()[0]:
                        continue
                    
                    supabase_cursor.execute(sql.SQL("SELECT * FROM {}").format(sql.Identifier(table)))
                    rows = supabase_cursor.fetchall()
                    
                    if rows:
                        col_names = [desc[0] for desc in supabase_cursor.description]
                        
                        local_conn = psycopg2.connect(**self.local_config)
                        local_cursor = local_conn.cursor()
                        
                        # Check if table exists locally
                        local_cursor.execute("""
                            SELECT EXISTS (
                                SELECT FROM information_schema.tables 
                                WHERE table_schema = 'public' AND table_name = %s
                            )
                        """, (table,))
                        
                        if local_cursor.fetchone()[0]:
                            local_cursor.execute(sql.SQL("TRUNCATE TABLE {} CASCADE").format(sql.Identifier(table)))
                            
                            for row in rows:
                                placeholders = ','.join(['%s'] * len(row))
                                insert_query = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                                    sql.Identifier(table),
                                    sql.SQL(',').join(map(sql.Identifier, col_names)),
                                    sql.SQL(placeholders)
                                )
                                local_cursor.execute(insert_query, row)
                            
                            total_restored += len(rows)
                            local_conn.commit()
                            print(f"Restored {len(rows)} records to {table}")
                        
                        local_cursor.close()
                        local_conn.close()
                except Exception as e:
                    print(f"Error restoring table {table}: {e}")
                    logger.error(f"Error restoring table {table}: {e}")
            
            supabase_cursor.close()
            supabase_conn.close()
            
            counts = self.get_local_counts()
            
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
            logger.error(f"Restore error: {e}")
            if backup_log_id:
                BackupLog.objects.filter(id=backup_log_id).update(
                    status='failed',
                    error_message=str(e),
                    completed_at=timezone.now()
                )
            return False, 0, {}