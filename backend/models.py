import json
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer
from database import Base


class Run(Base):
    __tablename__ = "runs"

    id = Column(String, primary_key=True)
    transcript_raw = Column(Text, nullable=False)
    status = Column(String, default="pending")  # pending, processing, needs_review, completed, failed
    current_step = Column(Integer, default=0)
    cleaned_transcript = Column(Text, nullable=True)
    extraction_json = Column(Text, nullable=True)
    clarifying_questions = Column(Text, nullable=True)
    human_resolutions = Column(Text, nullable=True)
    slack_output = Column(Text, nullable=True)
    email_output = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    failed_step = Column(Integer, nullable=True)
    title = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_extraction(self):
        if self.extraction_json:
            return json.loads(self.extraction_json)
        return None

    def set_extraction(self, data: dict):
        self.extraction_json = json.dumps(data)

    def get_clarifying(self):
        if self.clarifying_questions:
            return json.loads(self.clarifying_questions)
        return []

    def set_clarifying(self, data: list):
        self.clarifying_questions = json.dumps(data)

    def get_resolutions(self):
        if self.human_resolutions:
            return json.loads(self.human_resolutions)
        return []

    def set_resolutions(self, data: list):
        self.human_resolutions = json.dumps(data)
