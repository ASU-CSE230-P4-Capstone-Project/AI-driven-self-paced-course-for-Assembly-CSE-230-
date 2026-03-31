from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    userid: str
    password: str = Field(min_length=6, max_length=72)


class UserLogin(BaseModel):
    userid: str
    password: str = Field(max_length=72)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    userid: str
    message: str


class CreateAIQueryRequest(BaseModel):
    prompt: str
    context: str | None = None
    system_prompt: str | None = None
    session_id: str | None = None
    temperature: float | None = None
    top_p: float | None = None
    top_k: int | None = None
    endpoint: str | None = None
    enable_search: bool | None = None
    search_params: dict | None = None
    extra_input: dict | None = None
    extra_model_params: dict | None = None


class QuizGenerationRequest(BaseModel):
    module_id: str
    num_questions: int = Field(ge=1, le=50, default=10)
    exclude_question_prompts: list[str] = Field(
        default_factory=list,
        description="Previous question stems to avoid duplicating on regenerate.",
    )


class TopicResult(BaseModel):
    topic: str
    correct: int = Field(ge=0)
    total: int = Field(ge=1)


class QuizResultRequest(BaseModel):
    module_id: str
    score: int = Field(ge=0)
    total_questions: int = Field(ge=1)
    topic_results: list[TopicResult] = Field(default_factory=list)


class PineconeIngestRequest(BaseModel):
    text: str = Field(min_length=1)
    doc_id: str = Field(min_length=1)
    module_id: str | None = None
    topic: str | None = None
    source_file: str | None = None
    namespace: str | None = None
    chunk_size: int = Field(default=1200, ge=500, le=12000)
    chunk_overlap: int = Field(default=250, ge=0, le=4000)
    metadata: dict | None = None


class PineconeSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)
    namespace: str | None = None
    filter: dict | None = None


class PineconeIngestFolderRequest(BaseModel):
    folder_path: str = "/app/knowledge-base"
    namespace: str | None = None
    module_id: str | None = None
    topic: str | None = None
    chunk_size: int = Field(default=1200, ge=500, le=12000)
    chunk_overlap: int = Field(default=250, ge=0, le=4000)
    include_extensions: list[str] = Field(default_factory=lambda: [".pdf"])
    max_files: int = Field(default=5, ge=1, le=1000)
