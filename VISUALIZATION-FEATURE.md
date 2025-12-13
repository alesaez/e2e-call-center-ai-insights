# Chart & Visualization Feature

## Overview

The chatbot agents (AI Foundry and Copilot Studio) can now generate interactive charts, plots, and visualizations by including Python code in their responses. The system automatically detects Python code blocks, executes them safely, and displays the resulting visualizations to the user.

## How It Works

### Architecture

1. **Agent Response**: Agent includes Python visualization code in a markdown code block
2. **Interception**: `VisualizationService` intercepts the response
3. **Code Extraction**: Extracts Python code from ```python blocks
4. **Safe Execution**: Executes code in a sandboxed environment
5. **Image Generation**: Captures matplotlib plot as PNG
6. **Base64 Encoding**: Converts image to base64 string
7. **Storage**: Stores as attachment in Cosmos DB
8. **Display**: Frontend renders base64 image inline with chat

### Flow Diagram

```
Agent Response → VisualizationService → Python Execution → Matplotlib Plot
      ↓                                                           ↓
   Message Text                                            PNG Image
      ↓                                                           ↓
 Stored in Cosmos ← Base64 Attachment ← Base64 Encoding ← BytesIO Buffer
      ↓
   Frontend Display (img tag with data URI)
```

## Agent Instructions

### For AI Foundry / Copilot Studio Configuration

Add the following to your agent's system instructions:

````markdown
# Visualization Capabilities

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
````

### Example Agent Responses

#### Example 1: Sales Data Bar Chart

User: "Show me a bar chart of our Q4 sales by region"

Agent response:
```
Here's a bar chart showing Q4 sales by region:

```python
import matplotlib.pyplot as plt

regions = ['North', 'South', 'East', 'West']
sales = [125000, 98000, 142000, 110000]

plt.figure(figsize=(10, 6))
plt.bar(regions, sales, color=['#3498db', '#e74c3c', '#2ecc71', '#f39c12'])
plt.title('Q4 Sales by Region', fontsize=16, fontweight='bold')
plt.xlabel('Region', fontsize=12)
plt.ylabel('Sales ($)', fontsize=12)
plt.grid(axis='y', alpha=0.3)

# Add value labels on bars
for i, v in enumerate(sales):
    plt.text(i, v + 3000, f'${v:,}', ha='center', fontweight='bold')
```

As you can see, the East region led with $142,000 in sales.
```

#### Example 2: Trend Analysis Line Chart

User: "Visualize customer satisfaction scores over the last 6 months"

Agent response:
```
Here's the customer satisfaction trend:

```python
import matplotlib.pyplot as plt
import numpy as np

months = ['July', 'August', 'September', 'October', 'November', 'December']
scores = [4.2, 4.3, 4.5, 4.4, 4.6, 4.7]

plt.figure(figsize=(10, 6))
plt.plot(months, scores, marker='o', linewidth=2, markersize=8, color='#2ecc71')
plt.fill_between(range(len(months)), scores, alpha=0.3, color='#2ecc71')
plt.title('Customer Satisfaction Scores (Last 6 Months)', fontsize=16, fontweight='bold')
plt.xlabel('Month', fontsize=12)
plt.ylabel('Score (out of 5)', fontsize=12)
plt.ylim(4.0, 5.0)
plt.grid(True, alpha=0.3)
```

Customer satisfaction has shown steady improvement, reaching 4.7 in December.
```

## Backend Implementation

### VisualizationService Class

Located in `backend/visualization_service.py`:

**Key Methods:**
- `extract_code_blocks(text)`: Finds Python code blocks in markdown
- `execute_visualization_code(code)`: Safely executes Python code
- `process_message_for_visualizations(message_text)`: Main processing pipeline
- `get_agent_instructions()`: Returns agent system instructions

**Security Features:**
- Sandboxed execution environment
- Limited built-in functions (no file I/O, network access)
- Only safe imports (matplotlib, numpy, pandas)
- 10-second execution timeout
- Automatic cleanup of matplotlib figures

### Integration Points

**1. Service Initialization** (`main.py`):
```python
from visualization_service import visualization_service

copilot_studio_service = CopilotStudioService(settings, visualization_service)
ai_foundry_service = AIFoundryService(settings, visualization_service)
```

**2. Message Processing** (in both services):
```python
if self.visualization_service and response_text:
    processed_text, viz_attachments = self.visualization_service.process_message_for_visualizations(response_text)
    if viz_attachments:
        attachments.extend(viz_attachments)
```

**3. Attachment Format**:
```python
{
    "contentType": "image/png",
    "content": {
        "type": "base64",
        "data": "iVBORw0KGgoAAAANSUhEUgAA..."  # base64 string
    },
    "name": "visualization_1.png"
}
```

## Frontend Implementation

### Display Logic (`ChatbotPage.tsx`)

Renders base64 images inline with messages:

```tsx
{message.attachments?.map((attachment, index) => {
  // Render base64-encoded images (visualizations)
  if (attachment.contentType === 'image/png' && attachment.content?.type === 'base64') {
    return (
      <Box key={index} sx={{ mt: message.text ? 2 : 0 }}>
        <img
          src={`data:image/png;base64,${attachment.content.data}`}
          alt={attachment.name || 'Visualization'}
          style={{
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        />
      </Box>
    );
  }
})}
```

### TypeScript Interface Updates

**Updated `MessageAttachment`** (`chat_models.py`):
```python
class MessageAttachment(BaseModel):
    kind: Optional[AttachmentKind] = None
    uri: Optional[str] = None
    mime: Optional[str] = None
    title: Optional[str] = None
    contentType: Optional[str] = None
    content: Optional[Any] = None  # For base64 images
    name: Optional[str] = None
```

## Data Storage

### Cosmos DB Schema

Messages with visualizations are stored with attachments:

```json
{
  "id": "msg_abc123",
  "sessionId": "sess_xyz789",
  "role": "assistant",
  "content": "Here's the sales chart...",
  "attachments": [
    {
      "contentType": "image/png",
      "content": {
        "type": "base64",
        "data": "iVBORw0KGgoAAAANSUhEUgAA..."
      },
      "name": "visualization_1.png"
    }
  ],
  "createdAt": "2025-12-12T10:30:00Z"
}
```

## API Endpoints

### Get Visualization Instructions

```http
GET /api/config/visualization-instructions
```

**Response:**
```json
{
  "instructions": "# Visualization Instructions\n\n...",
  "enabled": true,
  "supported_libraries": ["matplotlib", "numpy", "pandas"]
}
```

## Dependencies

### Backend Requirements

Added to `backend/requirements.txt`:

```
# Visualization dependencies for chart/plot generation
matplotlib==3.9.3
numpy==2.2.1
pandas==2.2.3
```

### Installation

```bash
cd backend
pip install -r requirements.txt
```

## Testing

### Manual Test Cases

**Test 1: Simple Line Plot**
```python
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
y = np.sin(x)
plt.plot(x, y)
plt.title('Sine Wave')
plt.xlabel('X')
plt.ylabel('Y')
plt.grid(True)
```

**Test 2: Bar Chart**
```python
import matplotlib.pyplot as plt

categories = ['A', 'B', 'C', 'D']
values = [23, 45, 56, 78]

plt.bar(categories, values)
plt.title('Sample Bar Chart')
plt.xlabel('Categories')
plt.ylabel('Values')
```

**Test 3: Pandas DataFrame Visualization**
```python
import matplotlib.pyplot as plt
import pandas as pd

data = {
    'Month': ['Jan', 'Feb', 'Mar', 'Apr'],
    'Revenue': [50000, 55000, 60000, 58000]
}
df = pd.DataFrame(data)

plt.plot(df['Month'], df['Revenue'], marker='o')
plt.title('Monthly Revenue')
plt.xlabel('Month')
plt.ylabel('Revenue ($)')
plt.grid(True)
```

### Expected Behavior

1. ✅ Agent sends message with Python code block
2. ✅ Backend intercepts and extracts code
3. ✅ Code executes safely (10s timeout)
4. ✅ Plot generated and converted to PNG
5. ✅ Base64 string created
6. ✅ Attached to message response
7. ✅ Stored in Cosmos DB
8. ✅ Frontend displays image inline
9. ✅ Image persists across page refreshes

## Security Considerations

### Sandboxing

- **Limited __builtins__**: Only safe functions (range, len, int, float, etc.)
- **No dangerous imports**: File I/O, subprocess, os, sys are blocked
- **Read-only execution**: No side effects outside visualization
- **Timeout protection**: 10-second max execution time

### What's Blocked

- ❌ File operations (`open`, `write`, `read`)
- ❌ Network access (`requests`, `urllib`)
- ❌ System commands (`os.system`, `subprocess`)
- ❌ Code execution (`eval`, `exec` beyond sandboxed context)
- ❌ Import of unauthorized modules

### What's Allowed

- ✅ matplotlib for plotting
- ✅ numpy for numerical operations
- ✅ pandas for data manipulation
- ✅ Standard math operations
- ✅ List/dict/set operations

## Troubleshooting

### Issue: Code execution fails

**Symptoms**: No visualization appears, error in logs

**Solutions**:
1. Check backend logs for Python execution errors
2. Verify matplotlib backend is set to 'Agg' (non-interactive)
3. Ensure code doesn't use `plt.show()` (not needed)
4. Check for syntax errors in Python code

### Issue: Image not displaying

**Symptoms**: Message appears but no image

**Solutions**:
1. Verify `contentType === 'image/png'` in attachment
2. Check `content.type === 'base64'` exists
3. Inspect browser console for data URI errors
4. Verify base64 string is valid

### Issue: Visualization dependencies missing

**Symptoms**: ImportError in backend

**Solutions**:
```bash
cd backend
pip install -r requirements.txt
```

## Future Enhancements

### Potential Improvements

1. **Seaborn Support**: Add seaborn for statistical visualizations
2. **Plotly Interactive Charts**: Enable interactive plots
3. **Multiple Plots**: Support multiple visualizations per message
4. **Code Validation**: Pre-validate code before execution
5. **Performance Metrics**: Track execution time and success rate
6. **User Preferences**: Allow users to enable/disable feature
7. **Error Messages**: Display user-friendly error messages for failed executions
8. **Chart Templates**: Provide common chart templates for agents

### Code Examples for Future Libraries

**Seaborn** (requires adding `seaborn` to requirements.txt):
```python
import seaborn as sns
import matplotlib.pyplot as plt

data = [1, 2, 2, 3, 3, 3, 4, 4, 5]
sns.histplot(data, kde=True)
plt.title('Distribution')
```

**Plotly** (interactive, requires different approach):
```python
import plotly.graph_objects as go

fig = go.Figure(data=go.Bar(y=[2, 3, 1]))
fig.write_image("plot.png")  # Requires kaleido
```

## License & Credits

- **Matplotlib**: BSD-style license
- **NumPy**: BSD license
- **Pandas**: BSD 3-Clause license

Built for e2e-call-center-ai-insights project.
