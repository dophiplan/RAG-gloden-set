"""공통 로그 모듈"""
import os
import datetime
from pathlib import Path

def get_log_path(product: str, log_dir: Path = None) -> Path:
    if log_dir is None:
        project_root = Path(__file__).parent.parent.parent
        log_dir = project_root / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    return log_dir / f"{product}_{today}.log"

def log(product: str, node: str, input_ver: str, decision: str, basis: str):
    timestamp = datetime.datetime.now().isoformat(timespec='seconds')
    log_line = f"{timestamp}\t{product}\t{node}\t{input_ver}\t{decision}\t{basis}\n"
    log_path = get_log_path(product)
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(log_line)

def log_batch(product: str, node: str, input_ver: str, decisions: list):
    timestamp = datetime.datetime.now().isoformat(timespec='seconds')
    log_path = get_log_path(product)
    with open(log_path, "a", encoding="utf-8") as f:
        for decision, basis in decisions:
            line = f"{timestamp}\t{product}\t{node}\t{input_ver}\t{decision}\t{basis}\n"
            f.write(line)
