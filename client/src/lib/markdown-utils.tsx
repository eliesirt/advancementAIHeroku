import { Fragment } from 'react';

export function parseMarkdownToJSX(text: string): JSX.Element {
  if (!text) return <></>;

  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines
    if (!line.trim()) {
      elements.push(<br key={key++} />);
      continue;
    }
    
    // Handle headers (** text **)
    if (line.match(/^\*\*(.*?)\*\*$/)) {
      const headerText = line.replace(/^\*\*(.*?)\*\*$/, '$1');
      elements.push(
        <h3 key={key++} className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2 first:mt-0">
          {headerText}
        </h3>
      );
      continue;
    }
    
    // Handle bullet points
    if (line.match(/^[-•]\s/)) {
      const bulletText = line.replace(/^[-•]\s/, '');
      elements.push(
        <div key={key++} className="flex items-start gap-2 mb-1">
          <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
          <span className="text-gray-700 dark:text-gray-300">{parseInlineFormatting(bulletText)}</span>
        </div>
      );
      continue;
    }
    
    // Handle numbered lists
    if (line.match(/^\d+\.\s/)) {
      const listText = line.replace(/^\d+\.\s/, '');
      const number = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={key++} className="flex items-start gap-2 mb-1">
          <span className="text-blue-600 dark:text-blue-400 font-semibold mt-0.5 min-w-[1rem]">{number}.</span>
          <span className="text-gray-700 dark:text-gray-300">{parseInlineFormatting(listText)}</span>
        </div>
      );
      continue;
    }
    
    // Handle regular paragraphs
    elements.push(
      <p key={key++} className="text-gray-700 dark:text-gray-300 mb-2 leading-relaxed">
        {parseInlineFormatting(line)}
      </p>
    );
  }
  
  return <div className="space-y-1">{elements}</div>;
}

function parseInlineFormatting(text: string): JSX.Element {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.match(/^\*\*(.*?)\*\*$/)) {
          const boldText = part.replace(/^\*\*(.*?)\*\*$/, '$1');
          return (
            <strong key={index} className="font-semibold text-gray-900 dark:text-gray-100">
              {boldText}
            </strong>
          );
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}