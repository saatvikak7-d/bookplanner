from pydantic_settings import BaseSettings
from pydantic import Field
import os

_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")

class Settings(BaseSettings):
    openrouter_api_key: str = Field(default="")
    openrouter_model: str = Field(default="meta-llama/llama-3-8b-instruct")
    debug: bool = Field(default=False)

    model_config = {
        "env_file": _env_path,
        "env_file_encoding": "utf-8",
    }

settings = Settings()
