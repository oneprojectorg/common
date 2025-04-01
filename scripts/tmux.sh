#!/bin/bash

# Check if session exists
tmux has-session -t common 2>/dev/null

if [ $? != 0 ]; then
    # Create new session named 'common' in detached mode
    tmux new-session -d -s common

    # Rename the window
    tmux rename-window -t common:0 'common'

    # Split the window vertically for api on the left
    tmux split-window -v -p 50
    tmux select-pane -t 0
    tmux send-keys 'pnpm w:api dev' C-m

    # Split the right pane horizontally for app (top) and web (bottom)
    tmux select-pane -t 1
    tmux split-window -v -p 50
    tmux select-pane -t 1
    tmux send-keys 'pnpm w:app dev' C-m
    tmux select-pane -t 2
    tmux send-keys 'pnpm w:web dev' C-m
fi

# Attach to the session
tmux attach-session -t common
