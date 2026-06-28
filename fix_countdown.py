with open("src/utils/simulateActions.ts", encoding="utf-8") as f:
    content = f.read()

# Find the two remaining combustionCountdownAV blocks and replace them

target1 = (
    "if (\n                                    states[stateIndex].combustionCountdownAV !"
    + "==\n                                    undefined\n                                ) {\n                                    states[stateIndex].combustionCountdownAV =\n                                        Math.max(\n                                            states[stateIndex]\n                                                .combustionCountdownAV +\n                                                1000 / 70,\n                                            states[stateIndex].nextActionValue +\n                                                0.0001,\n                                        );\n                                }"
)
replace1 = """const countdown = states.find(
                                    (s) =>
                                        s.character.id ===
                                        states[stateIndex].combustionCountdownId,
                                );
                                if (countdown) {
                                    countdown.nextActionValue += 1000 / 70;
                                }"""

if target1 in content:
    content = content.replace(target1, replace1, 2)
    print("Replaced 2 occurrences")
else:
    print("Target not found")
    # Print the exact content around one occurrence
    idx = content.find("combustionCountdownAV")
    if idx >= 0:
        print(repr(content[idx - 50 : idx + 300]))

with open("src/utils/simulateActions.ts", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
