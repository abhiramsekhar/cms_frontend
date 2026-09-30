import re

with open('frontend/pages/doctor/prescriptions.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

script_match = re.search(r'<script type="module">(.*?)</script>', html_content, re.DOTALL)
if script_match:
    js_code = script_match.group(1)
    
    # remove single line comments
    js_code = re.sub(r'//.*', '', js_code)
    # remove multiline comments
    js_code = re.sub(r'/\*.*?\*/', '', js_code, flags=re.DOTALL)
    
    i = 0
    stack = []
    in_string = False
    string_char = ''
    in_template = False
    template_stack = []
    
    while i < len(js_code):
        c = js_code[i]
        if in_string:
            if c == '\\':
                i += 1
            elif c == string_char:
                in_string = False
        elif in_template:
            if c == '\\':
                i += 1
            elif c == '`':
                in_template = False
            elif c == '$' and i+1 < len(js_code) and js_code[i+1] == '{':
                template_stack.append('{')
                i += 1
        else:
            if c in ["'", '"']:
                in_string = True
                string_char = c
            elif c == '`':
                in_template = True
            elif c in ['{', '(', '[']:
                if len(template_stack) > 0 and c == '{':
                    template_stack.append('{')
                else:
                    stack.append((c, i))
            elif c in ['}', ')', ']']:
                if len(template_stack) > 0 and c == '}':
                    template_stack.pop()
                else:
                    if len(stack) > 0:
                        last, last_i = stack[-1]
                        if (c == '}' and last == '{') or (c == ')' and last == '(') or (c == ']' and last == '['):
                            stack.pop()
                        else:
                            pass
                    else:
                        pass
        i += 1
    
    for c, pos in stack:
        start = max(0, pos - 20)
        end = min(len(js_code), pos + 20)
        print(f"Unclosed '{c}' at position {pos}:")
        print("..." + js_code[start:end] + "...")
