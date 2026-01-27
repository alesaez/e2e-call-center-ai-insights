"""
Microsoft Fabric Lakehouse SQL query service.
Executes SQL queries against Fabric Lakehouse using authenticated connections.
"""
from typing import List, Dict, Any, Optional, Union
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential, ClientSecretCredential, AzureCliCredential
import struct
import os
import logging
from config import FabricLakehouseSettings

logger = logging.getLogger(__name__)

class FabricLakehouseService:
    """Service for executing SQL queries against Microsoft Fabric Lakehouse"""
    
    def __init__(self, config: FabricLakehouseSettings):
        self.config = config
        self.connection = None
        self._credential = None
        
    def _get_credential(self):
        """Get appropriate Azure credential based on configuration and environment detection"""
        if self._credential:
            return self._credential
        
        # Determine if we're running locally or in Azure Container Apps
        # Azure Container Apps sets CONTAINER_APP_NAME environment variable
        # For local development, ENVIRONMENT can be set to "development"
        is_localhost = (
            os.getenv("ENVIRONMENT") == "development" or
            os.getenv("CONTAINER_APP_NAME") is None  # Azure Container Apps sets this
        )
        
        logger.info(f"Fabric: Environment detection - is_localhost={is_localhost}, "
                   f"ENVIRONMENT={os.getenv('ENVIRONMENT')}, "
                   f"CONTAINER_APP_NAME={os.getenv('CONTAINER_APP_NAME')}")
        
        # Priority order:
        # 1. Service Principal (if client_id and client_secret provided)
        # 2. DefaultAzureCredential (for local development)
        # 3. ManagedIdentityCredential (for Azure Container Apps)
        
        if self.config.client_id and self.config.client_secret:
            logger.info("Fabric: Using Service Principal for authentication")
            self._credential = ClientSecretCredential(
                tenant_id=self.config.tenant_id,
                client_id=self.config.client_id,
                client_secret=self.config.client_secret
            )
        elif is_localhost:
            logger.info("Fabric: Using AzureCliCredential for localhost development (requires 'az login')")
            self._credential = AzureCliCredential()
        else:
            logger.info("Fabric: Using ManagedIdentityCredential for Azure Container Apps")
            self._credential = ManagedIdentityCredential()
            
        return self._credential
    
    async def connect(self):
        """
        Establish connection to Fabric Lakehouse SQL endpoint.
        Uses pyodbc with Azure AD authentication.
        """
        try:
            import pyodbc
        except ImportError:
            raise ImportError(
                "pyodbc is required for Fabric Lakehouse connection. "
                "Install it with: pip install pyodbc"
            )
        
        try:
            # Get authentication credential
            credential = self._get_credential()
            
            # Get access token for Fabric/Power BI
            # Fabric SQL endpoints use the Power BI resource scope
            token = credential.get_token("https://analysis.windows.net/powerbi/api/.default")
            
            # Convert token to bytes for SQL Server authentication
            token_bytes = token.token.encode("utf-16-le")
            token_struct = struct.pack(f'<I{len(token_bytes)}s', len(token_bytes), token_bytes)
            
            # SQL_COPT_SS_ACCESS_TOKEN is 1256
            SQL_COPT_SS_ACCESS_TOKEN = 1256
            
            # Build connection string
            # Strip https:// or http:// from endpoint if present (ODBC expects hostname only)
            server_name = self.config.endpoint.replace("https://", "").replace("http://", "")
            
            # Format: Server=<hostname>;Database=<lakehouse_id>;Encrypt=yes;TrustServerCertificate=no;
            connection_string = (
                f"Driver={{ODBC Driver 18 for SQL Server}};"
                f"Server={server_name};"
                f"Database={self.config.lakehouse_id};"
                f"Encrypt=yes;"
                f"TrustServerCertificate=no;"
                f"Connection Timeout={self.config.connection_timeout};"
            )
            
            # Connect with access token
            logger.info(f"Connecting to Fabric SQL endpoint:")
            logger.info(f"  Server: {server_name}")
            logger.info(f"  Database: {self.config.lakehouse_id}")
            logger.info(f"  Full Connection String: {connection_string}")
            self.connection = pyodbc.connect(
                connection_string,
                attrs_before={SQL_COPT_SS_ACCESS_TOKEN: token_struct}
            )
            
            logger.info(f"✓ Successfully connected to Fabric Lakehouse: {self.config.lakehouse_id}")
            
        except ImportError as e:
            logger.error(f"Missing required package: {e}")
            raise
        except Exception as e:
            logger.error(f"Failed to connect to Fabric Lakehouse: {e}")
            raise
    
    async def execute_query(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """
        Execute SQL query and return results as list of dictionaries.
        
        Args:
            query: SQL query to execute
            params: Optional tuple of parameters for parameterized queries
            
        Returns:
            List of dictionaries, one per row
        """
        if not self.connection:
            await self.connect()
        
        try:
            cursor = self.connection.cursor()
            
            # Set query timeout using connection attribute (not cursor.timeout)
            # This must be done before executing the query
            self.connection.timeout = self.config.query_timeout
            
            # Execute query with or without parameters
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            # Get column names
            columns = [column[0] for column in cursor.description]
            
            # Fetch results and convert to dictionaries
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
            
            cursor.close()
            logger.info(f"Query executed successfully, returned {len(results)} rows")
            return results
            
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            logger.error(f"Query: {query}")  # Log full query
            raise
    
    async def execute_scalar(self, query: str, params: Optional[tuple] = None) -> Any:
        """
        Execute query and return single scalar value (first column of first row).
        
        Args:
            query: SQL query to execute
            params: Optional tuple of parameters for parameterized queries
            
        Returns:
            Single value from first column of first row, or None if no results
        """
        results = await self.execute_query(query, params)
        if results and len(results) > 0:
            # Get first value from first row
            return list(results[0].values())[0]
        return None
    
    async def execute_many(self, queries: List[str]) -> List[List[Dict[str, Any]]]:
        """
        Execute multiple queries and return list of result sets.
        Useful for fetching multiple KPIs in parallel.
        
        Args:
            queries: List of SQL queries to execute
            
        Returns:
            List of result sets (each is a list of dictionaries)
        """
        results = []
        for query in queries:
            try:
                result = await self.execute_query(query)
                results.append(result)
            except Exception as e:
                logger.error(f"Query in batch failed: {e}")
                results.append([])  # Empty result for failed query
        return results
    
    async def test_connection(self) -> bool:
        """
        Test the connection to Fabric Lakehouse.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            result = await self.execute_scalar("SELECT 1 AS test")
            return result == 1
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False
    
    def close(self):
        """Close database connection"""
        if self.connection:
            try:
                self.connection.close()
                logger.info("Fabric Lakehouse connection closed")
            except Exception as e:
                logger.error(f"Error closing connection: {e}")
            finally:
                self.connection = None
                
    def __del__(self):
        """Cleanup connection on object destruction"""
        self.close()
