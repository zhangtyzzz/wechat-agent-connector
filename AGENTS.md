# AGENTS

## Purpose

This repository provides a generic WeChat gateway for local agent CLIs.

The design goal is:

- keep the WeChat transport independent from OpenClaw
- let a long-running gateway receive WeChat messages
- dispatch each message to a configurable local agent CLI
- wrap the operational workflow in a reusable Skill

## Repository Rules

- `packages/weixin-core` owns the WeChat transport and account state
- `packages/gateway` owns the event loop, shell adapter, and operator CLI
- `skills/wechat-agent` owns the Skill definition and helper scripts
- keep runtime behavior deterministic and scriptable
- prefer additive changes over hidden magic

## Release Standard

- update both `README.md` and `README.zh_CN.md` when behavior changes
- document new config fields in the example config and both READMEs
- keep the skill instructions concise; put implementation detail in repo docs
- do not add OpenClaw-specific runtime dependencies back into the core

