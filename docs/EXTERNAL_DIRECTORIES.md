# External Directories

This document describes directories in the repository that are external dependencies or reference materials.

## math2visual_repo/

This directory contains code and resources from the Math2Visual research project (ACL 2025 Findings). It provides visual language generation capabilities used by Visual4Math.

**Purpose**: Provides visual language generation models and utilities for creating pedagogically meaningful visuals from math word problems.

**Reference**: [Math2Visual Paper](https://aclanthology.org/2025.findings-acl.586/)

**Note**: This is a separate research project repository included as a dependency. For details, see `math2visual_repo/README.md`.

## ITC-handbook-main/

This directory contains deployment reference materials from the ETH ITC handbook, specifically for web server deployment on ETH infrastructure.

**Purpose**: Reference documentation for deploying web applications on ETH PEACH LAB servers.

**Note**: This is reference material for deployment procedures. See `docs/DEPLOYMENT.md` for Visual4Math-specific deployment instructions.

## additional_icons/ and my_icons/

These directories contain SVG icon libraries used by Tool 3 (Panel-Based Interface).

**Purpose**: Icon assets for the canvas-based visual editor.

## user_study_videos/

Contains video recordings from user study sessions.

**Purpose**: Research data collection - video recordings of participants using the tools.

**Note**: These files are excluded from version control via `.gitignore` due to size.

## experiments/

Contains experimental notebooks and scripts used during development.

**Purpose**: Development and testing artifacts.

**Note**: These are development artifacts and may not be necessary for production deployment.

