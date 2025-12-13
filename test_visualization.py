"""
Test script for visualization service.
Run this to verify the visualization feature is working correctly.
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from visualization_service import VisualizationService

def test_code_extraction():
    """Test extracting Python code blocks from markdown."""
    print("Test 1: Code Extraction")
    print("-" * 50)
    
    viz_service = VisualizationService()
    
    message = """
Here's a nice chart for you:

```python
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
y = np.sin(x)
plt.plot(x, y)
plt.title('Test Chart')
```

Hope this helps!
"""
    
    code_blocks = viz_service.extract_code_blocks(message)
    print(f"Found {len(code_blocks)} code block(s)")
    
    if code_blocks:
        print("\nExtracted code:")
        print(code_blocks[0])
        print("✓ Code extraction working")
    else:
        print("❌ Code extraction failed")
    
    print()

def test_visualization_detection():
    """Test detecting visualization-related code."""
    print("Test 2: Visualization Detection")
    print("-" * 50)
    
    viz_service = VisualizationService()
    
    viz_code = "plt.plot([1, 2, 3], [4, 5, 6])"
    non_viz_code = "x = 5\ny = 10\nprint(x + y)"
    
    is_viz1 = viz_service._is_visualization_code(viz_code)
    is_viz2 = viz_service._is_visualization_code(non_viz_code)
    
    print(f"Visualization code detected: {is_viz1}")
    print(f"Non-visualization code detected: {is_viz2}")
    
    if is_viz1 and not is_viz2:
        print("✓ Visualization detection working")
    else:
        print("❌ Visualization detection failed")
    
    print()

def test_code_execution():
    """Test executing visualization code and generating base64 image."""
    print("Test 3: Code Execution and Image Generation")
    print("-" * 50)
    
    viz_service = VisualizationService()
    
    code = """
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 2 * np.pi, 100)
y = np.sin(x)

plt.figure(figsize=(8, 5))
plt.plot(x, y, 'b-', linewidth=2)
plt.title('Sine Wave Test', fontsize=14)
plt.xlabel('X')
plt.ylabel('Y')
plt.grid(True, alpha=0.3)
"""
    
    image_base64 = viz_service.execute_visualization_code(code)
    
    if image_base64:
        print(f"✓ Image generated successfully!")
        print(f"  Base64 length: {len(image_base64)} characters")
        print(f"  First 50 chars: {image_base64[:50]}...")
    else:
        print("❌ Image generation failed")
    
    print()

def test_full_message_processing():
    """Test the full message processing pipeline."""
    print("Test 4: Full Message Processing")
    print("-" * 50)
    
    viz_service = VisualizationService()
    
    message = """
Here's your sales data visualization:

```python
import matplotlib.pyplot as plt

months = ['Jan', 'Feb', 'Mar', 'Apr']
sales = [50, 60, 55, 70]

plt.bar(months, sales, color='skyblue')
plt.title('Monthly Sales')
plt.xlabel('Month')
plt.ylabel('Sales (K)')
plt.grid(axis='y', alpha=0.3)
```

As you can see, April had the highest sales.
"""
    
    processed_text, attachments = viz_service.process_message_for_visualizations(message)
    
    print(f"Processed text length: {len(processed_text)} chars")
    print(f"Attachments generated: {len(attachments)}")
    
    if attachments:
        attachment = attachments[0]
        print(f"\nAttachment details:")
        print(f"  Content Type: {attachment['contentType']}")
        print(f"  Name: {attachment['name']}")
        print(f"  Has base64 data: {'data' in attachment['content']}")
        print(f"  Data type: {attachment['content'].get('type')}")
        print("✓ Full message processing working")
    else:
        print("❌ No attachments generated")
    
    print()

def test_agent_instructions():
    """Test retrieving agent instructions."""
    print("Test 5: Agent Instructions")
    print("-" * 50)
    
    instructions = VisualizationService.get_agent_instructions()
    
    print(f"Instructions length: {len(instructions)} chars")
    print(f"\nFirst 200 characters:")
    print(instructions[:200] + "...")
    
    if "matplotlib" in instructions and "plt.plot" in instructions:
        print("\n✓ Agent instructions available")
    else:
        print("\n❌ Agent instructions missing key content")
    
    print()

def run_all_tests():
    """Run all tests."""
    print("=" * 50)
    print("VISUALIZATION SERVICE TEST SUITE")
    print("=" * 50)
    print()
    
    try:
        test_code_extraction()
        test_visualization_detection()
        test_code_execution()
        test_full_message_processing()
        test_agent_instructions()
        
        print("=" * 50)
        print("ALL TESTS COMPLETED")
        print("=" * 50)
        
    except Exception as e:
        print(f"\n❌ Test suite failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_all_tests()
