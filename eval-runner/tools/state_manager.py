"""상태 관리"""
import json
import shutil
import datetime
from pathlib import Path

NODES = ["1_coverage", "2_generate", "3_verify_1axis", "4_2axis_handoff", "5_3rd_handoff", "6_confirm"]

def get_state_path(product: str) -> Path:
    return Path(__file__).parent.parent / "products" / product / "state.json"

def create_initial_state(product: str) -> dict:
    now = datetime.datetime.now().isoformat()
    nodes = {node: {"status": "idle", "at": None, "output": None} for node in NODES}
    return {
        "product": product,
        "current_node": NODES[0],
        "version": "1.0.0",
        "created_at": now,
        "updated_at": now,
        "nodes": nodes,
        "human_queue": [],
        "open_issues": []
    }

def load_state(product: str) -> dict:
    state_path = get_state_path(product)
    if state_path.exists():
        with open(state_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    state = create_initial_state(product)
    save_state(product, state)
    return state

def save_state(product: str, state: dict):
    state_path = get_state_path(product)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    if state_path.exists():
        shutil.copy2(state_path, state_path.with_suffix('.json.bak'))
    state['updated_at'] = datetime.datetime.now().isoformat()
    with open(state_path, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def update_node_state(product: str, node: str, **kwargs):
    state = load_state(product)
    if node not in state['nodes']:
        raise ValueError(f"Unknown node: {node}")
    node_state = state['nodes'][node]
    for key, value in kwargs.items():
        node_state[key] = value
    if 'status' in kwargs:
        node_state['at'] = datetime.datetime.now().isoformat()
    save_state(product, state)
    return state

def add_human_queue(product: str, node: str, items: list, description: str = ""):
    state = load_state(product)
    queue_item = {
        "node": node,
        "items": items,
        "since": datetime.datetime.now().isoformat(),
        "description": description
    }
    state['human_queue'].append(queue_item)
    if node in state['nodes']:
        state['nodes'][node]['status'] = 'waiting_human'
    save_state(product, state)
    return state
