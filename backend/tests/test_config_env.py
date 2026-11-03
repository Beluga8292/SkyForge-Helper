from pathlib import Path

import pytest

from app.core import config


def test_default_env_is_backend_file_independent_of_working_directory(tmp_path, monkeypatch):
    expected = Path(config.__file__).resolve().parents[2] / ".env"
    monkeypatch.chdir(tmp_path)
    assert config.Settings.model_config["env_file"] == expected
    assert config.DEFAULT_ENV_FILE == expected


@pytest.mark.parametrize("working_directory", ["root", "backend"])
def test_settings_factory_loads_default_env_from_any_cwd(tmp_path, monkeypatch, working_directory):
    env = tmp_path / "backend.env"
    env.write_text("HYPIXEL_API_KEY=fixture-env-key\n", encoding="utf-8")
    monkeypatch.setattr(config, "DEFAULT_ENV_FILE", env)
    monkeypatch.delenv("HYPIXEL_API_KEY", raising=False)
    monkeypatch.delenv("SBC_ENV_FILE", raising=False)
    folder = tmp_path / working_directory
    folder.mkdir()
    monkeypatch.chdir(folder)
    config.get_settings.cache_clear()
    try:
        settings = config.get_settings()
        assert settings.hypixel_key_configured
        assert settings.hypixel_api_key.get_secret_value() == "fixture-env-key"
        assert "fixture-env-key" not in str(settings.public_summary())
    finally:
        config.get_settings.cache_clear()


def test_explicit_env_override_and_process_environment_precedence(tmp_path, monkeypatch):
    env = tmp_path / "override.env"
    env.write_text("HYPIXEL_API_KEY=fixture-file-key\n", encoding="utf-8")
    monkeypatch.setenv("SBC_ENV_FILE", str(env))
    monkeypatch.setenv("HYPIXEL_API_KEY", "fixture-process-key")
    config.get_settings.cache_clear()
    try:
        assert config.get_settings().hypixel_api_key.get_secret_value() == "fixture-process-key"
    finally:
        config.get_settings.cache_clear()
