// Enhanced markdown renderer with KaTeX support for mathematical expressions
import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MarkdownTextProps {
  content: string;
}

const MarkdownText: React.FC<MarkdownTextProps> = ({ content }) => {
  const renderMarkdown = (text: string) => {
    if (!text) return '';
    
    let rendered = text;
    
    // Handle LaTeX display math \[ ... \] (block equations)
    rendered = rendered.replace(/\\\[([\s\S]*?)\\\]/g, (_match, mathContent) => {
      try {
        const html = katex.renderToString(mathContent, {
          displayMode: true,
          throwOnError: false
        });
        return `<div style="margin: 1em 0; text-align: center;">${html}</div>`;
      } catch (error) {
        return `<div style="margin: 1em 0; padding: 0.5em; background-color: #ffe6e6; border: 1px solid #ff9999; border-radius: 4px; text-align: center;">${mathContent}</div>`;
      }
    });
    
    // Handle LaTeX inline math \( ... \)
    rendered = rendered.replace(/\\\((.*?)\\\)/g, (_match, mathContent) => {
      try {
        const html = katex.renderToString(mathContent, {
          displayMode: false,
          throwOnError: false
        });
        return html;
      } catch (error) {
        return `<span style="background-color: #ffe6e6; padding: 2px 4px; border-radius: 3px;">${mathContent}</span>`;
      }
    });
    
    // Handle **bold** text (non-greedy)
    rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Handle *italic* text (non-greedy, but not already in bold)
    rendered = rendered.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    
    // Handle `code` text (non-greedy)
    rendered = rendered.replace(/`([^`]+)`/g, '<code style="background-color: #f1f1f1; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em;">$1</code>');
    
    // Handle ### headers
    rendered = rendered.replace(/^### (.+)$/gm, '<h3 style="font-size: 1.1em; font-weight: bold; margin: 0.5em 0;">$1</h3>');
    
    // Handle ## headers  
    rendered = rendered.replace(/^## (.+)$/gm, '<h2 style="font-size: 1.2em; font-weight: bold; margin: 0.7em 0;">$1</h2>');
    
    // Handle # headers
    rendered = rendered.replace(/^# (.+)$/gm, '<h1 style="font-size: 1.3em; font-weight: bold; margin: 0.8em 0;">$1</h1>');
    
    // Handle indented bullet points (with spaces before -)
    rendered = rendered.replace(/^(\s+)[-*] (.+)$/gm, (_match, spaces, content) => {
      const indentLevel = Math.floor(spaces.length / 2); // 2 spaces = 1 indent level
      return `<li style="margin-left: ${1 + indentLevel}em; list-style-type: disc;">${content}</li>`;
    });
    
    // Handle bullet points (lines starting with - or *)
    rendered = rendered.replace(/^[-*] (.+)$/gm, '<li style="margin-left: 1em; list-style-type: disc;">$1</li>');
    
    // Handle numbered lists (lines starting with numbers)
    rendered = rendered.replace(/^\d+\. (.+)$/gm, '<li style="margin-left: 1em; list-style-type: decimal;">$1</li>');
    
    // Handle line breaks (convert \n to <br />)
    rendered = rendered.replace(/\n/g, '<br />');
    
    return rendered;
  };

  return (
    <div 
      className="whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
};

export default MarkdownText;
