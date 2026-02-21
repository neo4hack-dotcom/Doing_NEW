import React from 'react';

interface FormattedTextProps {
  text: string;
  className?: string;
}

const FormattedText: React.FC<FormattedTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Split lines for processing
  const lines = text.split('\n');

  const processInlineFormatting = (content: string) => {
    // Regex to detect bold (**text**)
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const innerText = part.slice(2, -2);
        const lowerText = innerText.toLowerCase();

        let colorClass = "text-indigo-900 dark:text-indigo-200"; // Default bold color

        // Determine color based on keywords (English & French support)
        if (lowerText.match(/(alert|critical|blocker|issue|fail|error|danger|urgent|red)/)) {
            colorClass = "text-red-600 dark:text-red-400";
        } else if (lowerText.match(/(warning|attention|risk|challenge|amber|caution|note)/)) {
            colorClass = "text-orange-600 dark:text-orange-400";
        } else if (lowerText.match(/(success|achievement|done|completed|green|good)/)) {
            colorClass = "text-emerald-600 dark:text-emerald-400";
        }

        return (
          <span key={index} className={`font-bold ${colorClass}`}>
            {innerText}
          </span>
        );
      }

      // Handle Italics (*text*) and Underline (__text__) within non-bold parts
      const underlineParts = part.split(/(__.*?__)/g);
      return underlineParts.map((uPart, uIndex) => {
          if (uPart.startsWith('__') && uPart.endsWith('__')) {
              return <span key={`${index}-u-${uIndex}`} className="underline decoration-indigo-500 underline-offset-2">{uPart.slice(2, -2)}</span>;
          }

          // Italic split
          const italicParts = uPart.split(/(\*.*?\*)/g);
          return italicParts.map((iPart, iIndex) => {
              if (iPart.startsWith('*') && iPart.endsWith('*') && iPart.length > 2) {
                  return <span key={`${index}-u-${uIndex}-i-${iIndex}`} className="italic text-slate-700 dark:text-slate-200">{iPart.slice(1, -1)}</span>;
              }
              return iPart;
          });
      });
    });
  };

  return (
    <div className={`space-y-3 font-sans text-sm leading-relaxed text-slate-600 dark:text-slate-300 ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-2" />; // Empty line

        // Header detection: #, ##, ###, #### (Markdown headings)
        const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)/);
        const isClassicHeader =
                         (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 60) ||
                         trimmed.startsWith('• Context') || trimmed.startsWith('• Key') ||
                         trimmed.startsWith('• Contexte') || trimmed.startsWith('• À retenir');

        if (headerMatch || isClassicHeader) {
          let cleanText: string;
          let level = 3;
          if (headerMatch) {
            level = headerMatch[1].length;
            cleanText = headerMatch[2].replace(/\*\*/g, '').trim();
          } else {
            cleanText = trimmed.replace(/^#{1,4}\s*/, '').replace(/\*\*/g, '').trim();
          }
          const sizeClass = level === 1
            ? 'text-base font-extrabold'
            : level === 2
            ? 'text-sm font-bold'
            : 'text-xs font-bold';
          return (
            <h3 key={idx} className={`mt-4 mb-2 inline-block px-3 py-1 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/40 dark:to-purple-900/40 rounded-lg border-l-4 border-indigo-500 text-indigo-800 dark:text-indigo-100 shadow-sm ${sizeClass}`}>
              {cleanText}
            </h3>
          );
        }

        // List detection
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.match(/^\d+\.\s/)) {
            const content = trimmed.replace(/^[-•]\s+|^\d+\.\s+/, '');
            return (
                <div key={idx} className="flex items-start gap-2 pl-2">
                    <span className="mt-1.5 w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0" />
                    <span>{processInlineFormatting(content)}</span>
                </div>
            )
        }

        // Standard Paragraph
        return (
          <p key={idx} className="mb-1 text-justify">
            {processInlineFormatting(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

export default FormattedText;
