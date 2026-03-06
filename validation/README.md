# Validation Package — Checkpoint 2

This folder documents our prompt-based validation study for **ChronoFork**, an immersive learner–multi-agent co-roleplay system for divergent historical experiences.

## Goal

The goal of this validation is not to ask whether current AI tools are “good” in general, but whether they can support the specific educational and interaction requirements behind ChronoFork:

1. historically grounded counterfactual reasoning,
2. coherent multi-character roleplay,
3. learner-in-the-loop branching interaction,
4. plausibility control for divergent actions,
5. reflective comparison between canonical and counterfactual timelines.

## Tools Tested

We test the following existing tools:

- ChatGPT
- Claude
- Perplexity

## Validation Structure

This folder contains:

- `/methodology/`  
    The detailed prompting protocol and scoring rubric used for evaluation.
  - `PROMPTING_PROTOCOL.md`  
    Our scenarios, cases, tasks, and prompts.
  - `SCORING_RUBRIC.md`  
    The common rubric used to compare outputs across tools.

- `/runs/`  
  Prompt transcripts, outputs, and screenshots organized by tool and task.

- `/analysis/`  
  Gap analysis and opportunity framing.

- `/speed_dating/`  
  Structured discussion records used to refine priorities and identify product opportunities.

## Core Event

Our main validation scenario is the **Cuban Missile Crisis**, because it contains:
- multiple actors with conflicting goals,
- clear decision checkpoints,
- strong causal consequences,
- and historically plausible as well as implausible intervention space.

## What We Expect to Learn

This validation helps us identify:
- where current tools already work well,
- where they fail for historical counterfactual learning,
- and which design requirements ChronoFork must satisfy that current tools do not.