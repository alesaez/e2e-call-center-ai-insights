"""
Query configuration models for chatbot customization.
Stores reusable query templates that users/teams can configure.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class QueryTemplate(BaseModel):
    """
    A configurable query template for chatbot interactions.
    """
    id: Optional[str] = None
    name: str = Field(..., description="Display name for the query template")
    description: Optional[str] = Field(None, description="Description of what the query does")
    template: str = Field(..., description="The query template text with {placeholders}")
    category: str = Field(default="General", description="Category for organizing queries")
    is_active: bool = Field(default=True, description="Whether the query is active")
    user_id: Optional[str] = Field(None, description="User ID if user-specific")
    team_id: Optional[str] = Field(None, description="Team ID if team-specific")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Get Agent Performance",
                "description": "Query to retrieve agent performance metrics",
                "template": "Show me performance metrics for {agent_name} in the last {time_period}",
                "category": "Performance",
                "is_active": True
            }
        }

class QueryTemplateCreate(BaseModel):
    """
    Schema for creating a new query template.
    """
    name: str
    description: Optional[str] = None
    template: str
    category: str = "General"
    user_id: Optional[str] = None
    team_id: Optional[str] = None

class QueryTemplateUpdate(BaseModel):
    """
    Schema for updating an existing query template.
    """
    name: Optional[str] = None
    description: Optional[str] = None
    template: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

class QueryTemplateList(BaseModel):
    """
    Response schema for list of query templates.
    """
    templates: List[QueryTemplate]
    total: int
