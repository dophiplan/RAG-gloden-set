// 피그마 플러그인 메인 로직

// 현재 페이지의 모든 텍스트 노드 추출
function extractTextNodes(): Array<{
  id: string;
  text: string;
  fontName: FontName;
  fontSize: number;
  characters: string;
}> {
  const textNodes: ReturnType<typeof extractTextNodes> = [];
  
  function traverse(node: SceneNode) {
    if (node.type === 'TEXT') {
      textNodes.push({
        id: node.id,
        text: node.characters,
        fontName: node.fontName as FontName,
        fontSize: node.fontSize as number,
        characters: node.characters
      });
    }
    
    // 자식 노드 탐색
    if ('children' in node) {
      node.children.forEach(traverse);
    }
  }
  
  // 현재 페이지의 모든 노드 탐색
  figma.currentPage.children.forEach(traverse);
  
  return textNodes;
}

// 텍스트 업데이트
async function updateText(nodeId: string, newText: string) {
  const node = figma.getNodeById(nodeId);
  if (node && node.type === 'TEXT') {
    await figma.loadFontAsync(node.fontName as FontName);
    node.characters = newText;
    return true;
  }
  return false;
}

// 메시지 핸들러
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'extract-text':
      const texts = extractTextNodes();
      figma.ui.postMessage({
        type: 'text-extracted',
        data: texts
      });
      break;
      
    case 'update-text':
      const { nodeId, newText } = msg;
      const success = await updateText(nodeId, newText);
      figma.ui.postMessage({
        type: 'text-updated',
        nodeId,
        success
      });
      break;
      
    case 'translate-all':
      // 번역 API 호출
      const response = await fetch('http://localhost:3000/api/figma/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: extractTextNodes(),
          targetLang: msg.targetLang
        })
      });
      
      const result = await response.json();
      figma.ui.postMessage({
        type: 'translation-complete',
        data: result
      });
      break;
  }
};

// UI 창 열기 (400x600 사이즈)
figma.showUI(__html__, { width: 400, height: 600 });
