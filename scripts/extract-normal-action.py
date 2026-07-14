"""Replace inline code blocks in normal-action/index.ts using line-based extraction.

Uses unique code patterns (not Chinese comments) to identify block boundaries.
"""
import sys

PATH = r'c:\Users\andyzhou\HSRActionSequence\src\simulate\normal-action\index.ts'

with open(PATH, 'r', encoding='utf-8') as f:
    all_lines = f.readlines()

# Find block end: count ALL { and } chars in each line (K&R style)
def find_closing_brace(lines, start_idx, indent):
    """Find the line index of the closing brace at the given indent level.
    Handles K&R style where braces are at end of lines (e.g. ") {").
    """
    depth = 0
    started = False
    for i in range(start_idx, len(lines)):
        line = lines[i]
        stripped = line.lstrip('\t')
        t_count = len(line) - len(stripped)
        # Count { and } in this line (ignore those inside strings/comments for simplicity)
        opens = line.count('{')
        closes = line.count('}')
        if opens > 0:
            depth += opens
            started = True
        if closes > 0:
            depth -= closes
            if depth == 0 and started and t_count == indent:
                return i
    return -1

results = []

# ── Block 1: 白厄 Q 境界 (domain) ──
# Pattern: comment line followed by "if (" then isCharacterTarget + hasSkillEffect("W","counterW")
for i, line in enumerate(all_lines):
    s = line.strip()
    if s.startswith('if (') and 'isCharacterTarget(character)' in all_lines[i+1].strip():
        if 'hasSkillEffect(character.name, "W", "counterW")' in all_lines[i+2].strip():
            # This is the domain block. Go back to find comment line start
            start = i - 1  # Comment line
            # Find closing brace of outer if - it's at 1-tab indent
            end = find_closing_brace(all_lines, i, 1)
            if end >= 0:
                new_lines = [
                    '\t\t// domain establishment delegated to handlePhainonDomain\n',
                    '\t\tconst domainResult = handlePhainonDomain({\n',
                    '\t\t\tcharacter,\n',
                    '\t\t\tnormalUsesUltimate,\n',
                    '\t\t\tactionSpeed,\n',
                    '\t\t\tactionValue,\n',
                    '\t\t\tkey,\n',
                    '\t\t\tstateIndex,\n',
                    '\t\t\tstates,\n',
                    '\t\t\tinput,\n',
                    '\t\t\tactiveOdes,\n',
                    '\t\t\tskipAssistFollowUp,\n',
                    '\t\t\tbeforeInterruptIndices,\n',
                    '\t\t\tafterInterruptIndices: afterInterrupts.map((i) => interrupts.indexOf(i)),\n',
                    '\t\t\tclearAdvanceBlockAfterAction: beforeInterrupts.length > 0,\n',
                    '\t\t});\n',
                    '\t\tif (domainResult) return domainResult;\n',
                ]
                old_block = ''.join(all_lines[start:end+1])
                new_block = ''.join(new_lines)
                results.append((start, end, old_block, new_block, 'domain'))
            break

# ── Block 2: 流萤完全燃烧 (combustion) ──
for i, line in enumerate(all_lines):
    if line.strip() == 'let justActivatedCombustion = false;':
        start = i - 1  # Comment line
        # Find closing } of the if block
        end = find_closing_brace(all_lines, i + 1, 1)
        if end >= 0:
            new_lines = [
                '\t\t// combustion activation delegated to tryActivateCombustion\n',
                '\t\tconst justActivatedCombustion = tryActivateCombustion({\n',
                '\t\t\tcharacter,\n',
                '\t\t\tnormalUsesUltimate,\n',
                '\t\t\tstateIndex,\n',
                '\t\t\tstates,\n',
                '\t\t\tactionValue,\n',
                '\t\t});\n',
            ]
            old_block = ''.join(all_lines[start:end+1])
            new_block = ''.join(new_lines)
            results.append((start, end, old_block, new_block, 'combustion'))
        break

# ── Block 3: 流萤击破触发 (firefly break) ──
for i, line in enumerate(all_lines):
    if 'shouldCheckBreakTrigger(' in line:
        start = i - 1  # Comment line
        # This is inside a 3-tab indented block; find the closing } at 2-tab indent
        # Actually the structure is:
        # \t\t// comment
        # \t\tif (
        # \t\t\tshouldCheckBreakTrigger(
        # ...
        # \t\t\t);
        # \t\t}
        # The "if" starts at 2-tab indent
        end = find_closing_brace(all_lines, i + 1, 2)
        if end >= 0:
            new_lines = [
                '\t\t\t// firefly break check delegated to handleFireflyBreakCheck\n',
                '\t\t\thandleFireflyBreakCheck({\n',
                '\t\t\t\tstateIndex,\n',
                '\t\t\t\tnormalUsesUltimate,\n',
                '\t\t\t\tstates,\n',
                '\t\t\t\tactions,\n',
                '\t\t\t\tkey,\n',
                '\t\t\t\tcharacter,\n',
                '\t\t\t\tactionNo,\n',
                '\t\t\t\tactionValue,\n',
                '\t\t\t\tinput,\n',
                '\t\t\t});\n',
            ]
            old_block = ''.join(all_lines[start:end+1])
            new_block = ''.join(new_lines)
            results.append((start, end, old_block, new_block, 'firefly break'))
        break

# ── Block 4: 迷迷死亡 (meme death) ──
for i, line in enumerate(all_lines):
    if 'memeKillToggles' in line and 'killMeme' in all_lines[i+1].strip():
        start = i
        # This is: \t\tif (...) {\n\t\t\tkillMeme(...);\n\t\t}
        end = i + 2  # The closing }
        new_lines = [
            '\t\t\thandleMemeDeathCheck({\n',
            '\t\t\t\tkey,\n',
            '\t\t\t\tstateIndex,\n',
            '\t\t\t\tstates,\n',
            '\t\t\t\tactionValue,\n',
            '\t\t\t\tinput,\n',
            '\t\t\t});\n',
        ]
        old_block = ''.join(all_lines[start:end+1])
        new_block = ''.join(new_lines)
        results.append((start, end, old_block, new_block, 'meme death'))
        break

# ── Block 5: 记忆主 A 消耗史诗 (epic) ──
for i, line in enumerate(all_lines):
    if 'consumeMemoryTrailblazerEpic(' in line:
        # Go back to comment line
        comment_line = i
        for j in range(i, max(i-20, 0), -1):
            if all_lines[j].strip().startswith('//'):
                comment_line = j
                break
        start = comment_line
        # Find the outer if closing
        # The structure is:
        # \t// comment
        # \tif (...multi-line...) {
        #   ...body...
        # \t}
        # The "if" is at 1-tab indent
        # Find the if line
        if_line = comment_line
        for j in range(comment_line, i):
            if all_lines[j].strip() == 'if (':
                if_line = j
                break
        end = find_closing_brace(all_lines, if_line, 1)
        if end >= 0:
            new_lines = [
                '\t\t// memory trailblazer epic consumption delegated to handleMemoryTrailblazerEpicConsumption\n',
                '\t\thandleMemoryTrailblazerEpicConsumption({\n',
                '\t\t\tcharacter,\n',
                '\t\t\tresolvedSkill,\n',
                '\t\t\tusesUltimate,\n',
                '\t\t\tqIsFront,\n',
                '\t\t\tstateIndex,\n',
                '\t\t\tstates,\n',
                '\t\t\tactions,\n',
                '\t\t\tactionValue,\n',
                '\t\t\tactiveOdes,\n',
                '\t\t\tkey,\n',
                '\t\t});\n',
            ]
            old_block = ''.join(all_lines[start:end+1])
            new_block = ''.join(new_lines)
            results.append((start, end, old_block, new_block, 'epic'))
        break

# Apply replacements in reverse order (to preserve offsets)
results.sort(key=lambda x: x[0], reverse=True)
for start, end, old, new, name in results:
    if old != new:
        # Verify old matches what's in the file at those positions
        current = ''.join(all_lines[start:end+1])
        if current == old:
            all_lines[start:end+1] = [new]
            print(f'OK: {name} (lines {start+1}-{end+1})')
        else:
            print(f'FAIL: {name} - content mismatch at lines {start+1}-{end+1}')
            # Show diff
            if len(current) != len(old):
                print(f'  Length mismatch: current={len(current)} old={len(old)}')
    else:
        print(f'SKIP: {name} - no change needed')

with open(PATH, 'w', encoding='utf-8') as f:
    f.writelines(all_lines)

print(f'\nTotal replacements: {len([r for r in results if r[2] != r[3]])}')
