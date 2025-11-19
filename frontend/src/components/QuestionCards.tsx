import {
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Grid,
  Box,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PredefinedQuestion } from '../config/chatQuestions';

interface QuestionCardsProps {
  questions: PredefinedQuestion[];
  onQuestionSelect: (question: string) => void;
  disabled?: boolean;
}

export default function QuestionCards({ questions, onQuestionSelect, disabled = false }: QuestionCardsProps) {
  const theme = useTheme();

  const handleCardClick = (question: string) => {
    if (!disabled) {
      onQuestionSelect(question);
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Quick Questions:
      </Typography>
      <Grid container spacing={1}>
        {questions.map((q) => (
          <Grid item xs={12} sm={6} md={3} key={q.id}>
            <Card
              sx={{
                height: '100%',
                transition: 'all 0.2s ease-in-out',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                '&:hover': {
                  transform: disabled ? 'none' : 'translateY(-2px)',
                  boxShadow: disabled ? 'none' : theme.shadows[4],
                },
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <CardActionArea
                onClick={() => handleCardClick(q.question)}
                disabled={disabled}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'flex-start',
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {q.icon && (
                      <Typography variant="h6" sx={{ fontSize: '1.2rem' }}>
                        {q.icon}
                      </Typography>
                    )}
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {q.title}
                    </Typography>
                  </Box>
                  
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: '0.85rem',
                      lineHeight: 1.3,
                      mb: 1,
                    }}
                  >
                    {q.question}
                  </Typography>
                  
                  <Chip
                    label={q.category}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontSize: '0.7rem',
                      height: '20px',
                      '& .MuiChip-label': {
                        px: 1,
                      },
                    }}
                  />
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}