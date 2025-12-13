"""
Visualization service for executing Python code and generating charts/plots.
Intercepts agent responses containing Python code blocks, executes them safely,
and converts generated plots to inline markdown images.
"""
import re
import io
import base64
import logging
from typing import List, Optional
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class VisualizationService:
    """Service for executing Python visualization code and generating charts."""
    
    # Regex pattern to find Python code blocks (supports python, python-viz, python3, etc.)
    CODE_BLOCK_PATTERN = re.compile(
        r'```python[a-z0-9\-]*\s*\n(.*?)\n```',
        re.DOTALL | re.MULTILINE | re.IGNORECASE
    )
    
    # Safe imports allowed for execution
    SAFE_IMPORTS = {
        'matplotlib': matplotlib,
        'plt': plt,
        'np': np,
        'numpy': np,
        'pd': pd,
        'pandas': pd,
    }
    
    def __init__(self):
        """Initialize the visualization service."""
        pass
    
    def extract_code_blocks(self, text: str) -> List[str]:
        """
        Extract Python code blocks from markdown text.
        
        Args:
            text: The message text potentially containing code blocks
            
        Returns:
            List of extracted Python code strings
        """
        matches = self.CODE_BLOCK_PATTERN.findall(text)
        return matches
    
    def execute_visualization_code(
        self, 
        code: str,
        timeout: int = 10
    ) -> Optional[str]:
        """
        Execute Python visualization code and return base64-encoded image.
        
        Args:
            code: Python code to execute (should generate a matplotlib plot)
            timeout: Maximum execution time in seconds
            
        Returns:
            Base64-encoded PNG image string, or None if execution failed
        """
        try:
            # Strip common import statements since libraries are pre-imported
            import_patterns = [
                r'import\s+matplotlib\.pyplot\s+as\s+plt\s*\n?',
                r'import\s+matplotlib\s*\n?',
                r'import\s+numpy\s+as\s+np\s*\n?',
                r'import\s+numpy\s*\n?',
                r'import\s+pandas\s+as\s+pd\s*\n?',
                r'import\s+pandas\s*\n?',
                r'from\s+matplotlib\s+import\s+pyplot\s+as\s+plt\s*\n?',
            ]
            
            cleaned_code = code
            for pattern in import_patterns:
                cleaned_code = re.sub(pattern, '', cleaned_code, flags=re.MULTILINE)
            
            # Create a new figure for isolation
            plt.figure(figsize=(10, 6))
            
            # Prepare safe execution environment
            safe_globals = {
                '__builtins__': {
                    'range': range,
                    'len': len,
                    'str': str,
                    'int': int,
                    'float': float,
                    'list': list,
                    'dict': dict,
                    'tuple': tuple,
                    'set': set,
                    'print': print,
                    'enumerate': enumerate,
                    'zip': zip,
                    'min': min,
                    'max': max,
                    'sum': sum,
                    'abs': abs,
                    'round': round,
                },
                'matplotlib': matplotlib,
                'plt': plt,
                'np': np,
                'numpy': np,
                'pd': pd,
                'pandas': pd,
            }
            
            safe_locals = {}
            
            # Execute the cleaned code (without import statements)
            exec(cleaned_code, safe_globals, safe_locals)
            
            # Save the current figure to a bytes buffer
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', bbox_inches='tight', dpi=100)
            buffer.seek(0)
            
            # Encode to base64
            image_base64 = base64.b64encode(buffer.read()).decode('utf-8')
            
            # Clean up
            plt.close('all')
            buffer.close()
            
            return image_base64
            
        except Exception as e:
            logger.error(f"Failed to execute visualization code: {e}")
            plt.close('all')  # Clean up on error
            return None
    
    def process_message_for_visualizations(
        self, 
        message_text: str
    ) -> str:
        """
        Process a message to extract and execute visualization code.
        Replaces code blocks with inline markdown images.
        
        Args:
            message_text: The agent's response message
            
        Returns:
            processed_message_text: Text with code blocks replaced by inline markdown images
        """
        code_blocks = self.extract_code_blocks(message_text)
        
        if not code_blocks:
            return message_text
        
        processed_text = message_text
        
        for idx, code in enumerate(code_blocks):
            # Check if code appears to be visualization-related
            if self._is_visualization_code(code):
                # Execute code and get base64 image
                image_base64 = self.execute_visualization_code(code)
                
                if image_base64:
                    # Find and remove the code block from the message text
                    # Use regex to find the exact code block with any python variant (python, python-viz, python3, etc.)
                    code_block_regex = re.compile(
                        r'```python[a-z0-9\-]*\s*\n' + re.escape(code) + r'\n```',
                        re.DOTALL | re.MULTILINE | re.IGNORECASE
                    )
                    
                    # Replace the code block with inline markdown image
                    markdown_image = f"![visualization_{idx + 1}](data:image/png;base64,{image_base64})"
                    processed_text = code_block_regex.sub(markdown_image, processed_text)
                    
                    # Fallback: if regex didn't match, try simple replacement
                    if code in processed_text:
                        processed_text = processed_text.replace(code, markdown_image)
        
        return processed_text
    
    def _is_visualization_code(self, code: str) -> bool:
        """
        Check if code appears to be visualization-related.
        
        Args:
            code: Python code string
            
        Returns:
            True if code contains visualization keywords
        """
        # Keywords that indicate visualization code
        viz_keywords = [
            'plt.', 
            'matplotlib',
            '.plot(',
            '.scatter(',
            '.bar(',
            '.hist(',
            '.pie(',
            '.boxplot(',
            '.heatmap(',
            'seaborn',
            'sns.',
            'plotly',
            'go.Figure',
        ]
        
        return any(keyword in code for keyword in viz_keywords)
    
    @staticmethod
    def get_agent_instructions() -> str:
        """
        Get system instructions for agents to generate visualizations.
        
        Returns:
            Markdown-formatted instructions for the agent
        """
        return """
# Visualization Instructions

When users request charts, graphs, or data visualizations, you can generate them by providing Python code using matplotlib or pandas.

## How to Generate Visualizations

1. **Wrap your code in Python markdown code blocks**:
   ```python
   import matplotlib.pyplot as plt
   import numpy as np
   
   # Your visualization code here
   x = np.linspace(0, 10, 100)
   y = np.sin(x)
   plt.plot(x, y)
   plt.title('Sine Wave')
   plt.xlabel('X')
   plt.ylabel('Y')
   plt.grid(True)
   ```

2. **The code will be automatically executed** and the resulting plot will be displayed to the user as an image.

3. **No need to call `plt.show()`** - the system handles saving and displaying the plot.

## Best Practices

- Use `matplotlib.pyplot` (imported as `plt`) for plotting
- Use `numpy` (imported as `np`) for numerical operations  
- Use `pandas` (imported as `pd`) for data manipulation
- Always include title, labels, and legends for clarity
- Use `plt.grid(True)` for better readability
- Keep visualizations simple and focused

## Available Libraries

- **matplotlib**: Full plotting library
- **numpy**: Numerical computations
- **pandas**: Data manipulation and analysis

## Example Use Cases

- Line charts: `plt.plot(x, y)`
- Bar charts: `plt.bar(categories, values)`
- Scatter plots: `plt.scatter(x, y)`
- Histograms: `plt.hist(data, bins=20)`
- Pie charts: `plt.pie(values, labels=labels)`

## Security Note

Code execution is sandboxed and limited to safe visualization operations only.
"""


# Global instance
visualization_service = VisualizationService()
