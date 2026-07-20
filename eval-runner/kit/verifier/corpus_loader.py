"""
Corpus Loader + 공백무시 Verifier
PDF/xlsx 원문 로딩 및 strict→whitespace-ignored 매칭
"""
import sys
from pathlib import Path

# 프로젝트 루트 추가
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

try:
    import fitz  # PyMuPDF
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False

try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False


def normalize_text(text: str) -> str:
    """공백 제거하여 정규화 (공백무시 비교용)"""
    if text is None:
        return ""
    return ''.join(str(text).split())


def extract_pdf_text(pdf_path: Path) -> str:
    """PDF에서 텍스트 추출"""
    if not HAS_FITZ:
        raise ImportError("PyMuPDF가 설치되지 않았습니다. pip install PyMuPDF")
    
    text = ""
    try:
        doc = fitz.open(pdf_path)
        for page in doc:
            text += page.get_text()
        doc.close()
    except Exception as e:
        print(f"PDF 추출 오류 {pdf_path}: {e}")
    
    return text


def extract_xlsx_text(xlsx_path: Path) -> str:
    """xlsx에서 텍스트 추출 (모든 셀의 문자열 값 연결)"""
    if not HAS_OPENPYXL:
        raise ImportError("openpyxl이 설치되지 않았습니다. pip install openpyxl")
    
    text_parts = []
    try:
        wb = openpyxl.load_workbook(xlsx_path, data_only=True)
        for ws in wb.worksheets:
            for row in ws.iter_rows(values_only=True):
                for cell in row:
                    if cell is not None:
                        text_parts.append(str(cell))
        wb.close()
    except Exception as e:
        print(f"XLSX 추출 오류 {xlsx_path}: {e}")
    
    return " ".join(text_parts)


def load_corpus(corpus_dir: Path) -> dict:
    """
    코퍼스 폴터 내 모든 PDF/xlsx/txt/md 파일 로드
    
    Returns:
        {filename: raw_text} 딕셔너리
    """
    corpus = {}
    
    if not corpus_dir.exists() or not corpus_dir.is_dir():
        return corpus
    
    # 지원하는 확장자
    extensions = ['*.pdf', '*.xlsx', '*.txt', '*.md']
    
    for pattern in extensions:
        for file_path in corpus_dir.rglob(pattern):
            try:
                if file_path.suffix.lower() == '.pdf':
                    text = extract_pdf_text(file_path)
                elif file_path.suffix.lower() == '.xlsx':
                    text = extract_xlsx_text(file_path)
                elif file_path.suffix.lower() in ['.txt', '.md']:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        text = f.read()
                else:
                    continue
                
                corpus[file_path.name] = text
                
            except Exception as e:
                print(f"파일 로드 오류 {file_path}: {e}")
                continue
    
    return corpus


def verify_excerpt(excerpt: str, corpus: dict) -> tuple:
    """
    발췌를 코퍼스와 대조 (strict 우선 → 공백무시 재시도)
    
    Args:
        excerpt: 검증할 발췌 텍스트
        corpus: {filename: raw_text} 딕셔너리
    
    Returns:
        (status, found_in_files)
        status: 'ok' | 'partial' | 'missing'
        found_in_files: list of filenames
    """
    if not excerpt or not corpus:
        return 'missing', []
    
    excerpt_str = str(excerpt)
    
    # 1단계: Strict 매칭 (정확 일치)
    strict_matches = []
    for filename, text in corpus.items():
        if excerpt_str in text:
            strict_matches.append(filename)
    
    if strict_matches:
        return 'ok', strict_matches
    
    # 2단계: 공백무시 매칭 (정규화된 텍스트로 비교)
    normalized_excerpt = normalize_text(excerpt_str)
    if len(normalized_excerpt) < 3:  # 너무 짧으면 정확도 낮음
        return 'missing', []
    
    whitespace_matches = []
    partial_matches = []
    
    for filename, text in corpus.items():
        normalized_text = normalize_text(text)
        
        # 공백무시 정확 일치
        if normalized_excerpt in normalized_text:
            whitespace_matches.append(filename)
            continue
        
        # 부분 매칭: 발췄의 앞/뒤 20자가 각각 존재하는지
        excerpt_len = len(normalized_excerpt)
        prefix_len = min(20, excerpt_len)
        suffix_len = min(20, excerpt_len)
        
        prefix = normalized_excerpt[:prefix_len]
        suffix = normalized_excerpt[-suffix_len:]
        
        if prefix in normalized_text and suffix in normalized_text:
            partial_matches.append(filename)
    
    if whitespace_matches:
        return 'ok', whitespace_matches
    elif partial_matches:
        return 'partial', partial_matches
    else:
        return 'missing', []
