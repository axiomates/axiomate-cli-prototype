import { useState, useCallback, useEffect, useRef } from "react";
import type { Message } from "../components/MessageOutput.js";
import {
	groupMessages,
	canCollapse,
	type MessageGroup,
} from "../models/messageGroup.js";

export type CollapseState = {
	/** Set of collapsed group IDs */
	collapsedGroups: Set<string>;
	/** Computed message groups */
	messageGroups: MessageGroup[];
	/** Toggle collapse state for a group */
	toggleCollapse: (groupId: string) => void;
	/** Expand all groups (including reasoning and askUserQA) */
	expandAll: (
		setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
	) => void;
	/** Collapse all collapsible groups */
	collapseAll: (
		setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
	) => void;
	/** Toggle reasoning collapse for a message */
	toggleReasoningCollapse: (
		msgIndex: number,
		setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
	) => void;
	/** Toggle askUser collapse for a message */
	toggleAskUserCollapse: (
		msgIndex: number,
		setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
	) => void;
	/** Reset collapse state (for session switch/clear) */
	resetCollapseState: () => void;
};

/**
 * Hook for managing collapse state of message groups and message sections
 */
export function useCollapseState(messages: Message[]): CollapseState {
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
		new Set(),
	);

	// Compute message groups (memoized by React)
	const messageGroups = groupMessages(messages);

	// Auto-collapse: when new group arrives, collapse the previous one
	const prevGroupCountRef = useRef(0);
	useEffect(() => {
		const currentCount = messageGroups.length;
		if (currentCount > prevGroupCountRef.current && currentCount > 1) {
			// New group arrived, collapse the previous one (second to last)
			const prevGroup = messageGroups[currentCount - 2];
			if (prevGroup && canCollapse(prevGroup)) {
				setCollapsedGroups((prev) => {
					const next = new Set(prev);
					next.add(prevGroup.id);
					return next;
				});
			}
		}
		prevGroupCountRef.current = currentCount;
	}, [messageGroups]);

	// Toggle single group collapse state
	const toggleCollapse = useCallback((groupId: string) => {
		setCollapsedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(groupId)) {
				next.delete(groupId);
			} else {
				next.add(groupId);
			}
			return next;
		});
	}, []);

	// Expand all groups (including reasoning and askUserQA in messages)
	const expandAll = useCallback(
		(setMessages: React.Dispatch<React.SetStateAction<Message[]>>) => {
			setCollapsedGroups(new Set());
			// Expand all reasoning and askuser
			setMessages((prev) =>
				prev.map((msg) => ({
					...msg,
					reasoningCollapsed: false,
					askUserCollapsed: false,
				})),
			);
		},
		[],
	);

	// Collapse all collapsible groups
	const collapseAll = useCallback(
		(setMessages: React.Dispatch<React.SetStateAction<Message[]>>) => {
			const toCollapse = messageGroups
				.filter((g) => canCollapse(g))
				.map((g) => g.id);
			setCollapsedGroups(new Set(toCollapse));
			// Collapse all reasoning and askuser
			setMessages((prev) =>
				prev.map((msg) => ({
					...msg,
					reasoningCollapsed: (msg.reasoning?.length ?? 0) > 0,
					askUserCollapsed: !!msg.askUserQA,
				})),
			);
		},
		[messageGroups],
	);

	// Toggle reasoning collapse for a specific message
	const toggleReasoningCollapse = useCallback(
		(
			msgIndex: number,
			setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
		) => {
			setMessages((prev) => {
				const newMessages = [...prev];
				const msg = newMessages[msgIndex];
				if (msg) {
					newMessages[msgIndex] = {
						...msg,
						reasoningCollapsed: !msg.reasoningCollapsed,
					};
				}
				return newMessages;
			});
		},
		[],
	);

	// Toggle askUser collapse for a specific message
	const toggleAskUserCollapse = useCallback(
		(
			msgIndex: number,
			setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
		) => {
			setMessages((prev) => {
				const newMessages = [...prev];
				const msg = newMessages[msgIndex];
				if (msg) {
					newMessages[msgIndex] = {
						...msg,
						askUserCollapsed: !msg.askUserCollapsed,
					};
				}
				return newMessages;
			});
		},
		[],
	);

	// Reset collapse state (for session switch/clear)
	const resetCollapseState = useCallback(() => {
		setCollapsedGroups(new Set());
		prevGroupCountRef.current = 0;
	}, []);

	return {
		collapsedGroups,
		messageGroups,
		toggleCollapse,
		expandAll,
		collapseAll,
		toggleReasoningCollapse,
		toggleAskUserCollapse,
		resetCollapseState,
	};
}
