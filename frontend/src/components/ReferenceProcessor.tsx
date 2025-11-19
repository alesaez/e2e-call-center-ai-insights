import { Chip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ReactNode, useMemo } from 'react';

interface ReferenceProcessorProps {
  children: ReactNode;
  isUser?: boolean;
}

export default function ReferenceProcessor({ children, isUser = false }: ReferenceProcessorProps) {
  const theme = useTheme();

  const processedContent = useMemo(() => {
    // Convert children to string if it's simple text
    if (typeof children === 'string') {
      return processTextForReferences(children, isUser, theme);
    }
    
    // For complex React nodes, return as-is for now
    return children;
  }, [children, isUser, theme]);

  return <>{processedContent}</>;
}

function processTextForReferences(text: string, isUser: boolean, theme: any): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  
  // Pattern for citations like [1], [Source Name], etc.
  const citationPattern = /\[([^\]]+)\]/g;
  const linkPattern = /(https?:\/\/[^\s]+)/g;
  
  // Find all citations
  const citations: Array<{ match: RegExpMatchArray; type: 'citation' }> = [];
  let match;
  
  while ((match = citationPattern.exec(text)) !== null) {
    citations.push({ match, type: 'citation' });
  }
  
  // Find all links
  while ((match = linkPattern.exec(text)) !== null) {
    citations.push({ match, type: 'link' } as any);
  }
  
  // Sort by position
  citations.sort((a, b) => a.match.index! - b.match.index!);
  
  // Process each match
  citations.forEach(({ match, type }, index) => {
    const start = match.index!;
    const end = start + match[0].length;
    
    // Add text before this match
    if (start > lastIndex) {
      const textBefore = text.substring(lastIndex, start);
      if (textBefore.trim()) {
        parts.push(
          <Typography key={`text-${index}`} variant="body2" component="span">
            {textBefore}
          </Typography>
        );
      }
    }
    
    // Add the reference bubble
    if (type === 'citation') {
      parts.push(
        <Chip
          key={`ref-${index}`}
          size="small"
          icon={<span style={{ fontSize: '0.7em' }}>📖</span>}
          label={match[1]}
          sx={{
            mx: 0.25,
            my: 0.125,
            height: 'auto',
            minHeight: 20,
            fontSize: '0.7em',
            fontWeight: 500,
            backgroundColor: isUser 
              ? 'rgba(255,255,255,0.2)' 
              : theme.palette.secondary.light,
            color: isUser 
              ? theme.palette.primary.contrastText 
              : theme.palette.secondary.contrastText,
            borderRadius: 2,
            '& .MuiChip-label': {
              px: 0.75,
              py: 0.25,
            },
            '& .MuiChip-icon': {
              marginLeft: 0.5,
              marginRight: -0.25,
            },
          }}
        />
      );
    } else if (type === 'link') {
      const url = match[0];
      const displayText = url.length > 25 ? `${url.substring(0, 25)}...` : url;
      
      parts.push(
        <Chip
          key={`link-${index}`}
          size="small"
          icon={<span style={{ fontSize: '0.7em' }}>🔗</span>}
          label={displayText}
          clickable
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          sx={{
            mx: 0.25,
            my: 0.125,
            height: 'auto',
            minHeight: 20,
            fontSize: '0.7em',
            fontWeight: 500,
            backgroundColor: isUser 
              ? 'rgba(255,255,255,0.2)' 
              : theme.palette.primary.light,
            color: isUser 
              ? theme.palette.primary.contrastText 
              : theme.palette.primary.contrastText,
            borderRadius: 2,
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: isUser 
                ? 'rgba(255,255,255,0.3)' 
                : theme.palette.primary.main,
              transform: 'translateY(-1px)',
              boxShadow: theme.shadows[2],
            },
            '& .MuiChip-label': {
              px: 0.75,
              py: 0.25,
            },
            '& .MuiChip-icon': {
              marginLeft: 0.5,
              marginRight: -0.25,
            },
          }}
        />
      );
    }
    
    lastIndex = end;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    if (remainingText.trim()) {
      parts.push(
        <Typography key="text-end" variant="body2" component="span">
          {remainingText}
        </Typography>
      );
    }
  }
  
  return parts.length > 0 ? parts : [
    <Typography key="original" variant="body2" component="span">
      {text}
    </Typography>
  ];
}