---
name: code-refactoring
description: Restructures existing code to improve readability and performance without altering external behavior. Use when asked to clean up, refactor, optimize, or modernize code.
---

# Agent Skill: Code Refactoring

## 🎯 Objective
Restructure existing computer code to improve its internal structure, readability, and performance without altering its external behavior or adding new features.

## ⚙️ Triggers
* Explicit user command to "refactor", "clean up", "optimize", or "modernize" specific files, classes, or functions.
* Identification of code smells (e.g., high cyclomatic complexity, deep nesting, DRY violations) during standard code review tasks.

## 📜 Core Directives

### 1. The Strict "Two Hats" Rule
Never mix refactoring with feature development or bug fixing. You are wearing the "Refactoring Hat." If you identify a bug while refactoring, document it and inform the user, but do not change the behavior to fix it unless explicitly instructed. 

### 2. Test-Driven Safety
* Assess existing test coverage before modifying code.
* If tests exist, ensure the refactored code will pass the existing assertions.
* If coverage is severely lacking, warn the user and offer to generate baseline regression tests *before* altering the source code.

### 3. API & Signature Preservation
* **Internal APIs:** You may extract or rename internal helper functions to improve readability.
* **Public APIs:** Do NOT change public-facing function signatures, endpoints, or exported module interfaces unless explicitly requested. If modifying a signature is unavoidable for the refactor, you must identify and update all dependent calls within the provided context.

### 4. Atomic Execution
Do not attempt a massive paradigm shift in a single output. Break down structural changes into logical, incremental steps (e.g., step one: extract magic strings to constants; step two: implement strategy pattern).

## 🛠️ Refactoring Priorities

* **Cognitive Load Reduction:** Extract complex, nested logical conditions into well-named helper functions. Replace arbitrary magic numbers with named constants.
* **Structural Cohesion:** Break down monolithic functions (Extract Method). Group related variables and functions into cohesive classes or modules. 
* **Algorithmic Optimization:** Identify and resolve obvious inefficiencies, such as replacing nested iteration ($O(n^2)$) with hash map lookups ($O(n)$ or $O(1)$) where memory constraints allow.
* **Modernization:** Update deprecated syntax to modern language standards (e.g., moving from `.then()` chains to `async/await`, or leveraging modern standard library functions).

## 📤 Output Requirements

When executing this skill, structure your response as follows:
1. **Diagnosis:** A bulleted list of the specific code smells identified.
2. **The Code:** The fully refactored code block. 
3. **Justification:** A brief technical explanation of *why* the new structure is superior and the specific design patterns utilized.
