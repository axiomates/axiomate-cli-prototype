// i18n type definitions

export type Locale = "en" | "zh-CN";

export type Translations = {
	// App layout
	app: {
		inputMode: string;
		browseMode: string;
		modeSwitchHint: string;
	};

	// Welcome screen
	welcome: {
		title: string;
		testVersion: string;
		testVersionDesc: string;
		pressAnyKey: string;
		configuring: string;
		restarting: string;
	};

	// Splash screen
	splash: {
		loading: string;
		discoveringTools: string;
		loadingAI: string;
	};

	// Input component
	input: {
		placeholder: string;
		slashMenuTitle: string;
		fileMenuTitle: string;
		helpPanelTitle: string;
		typeToFilter: string;
		noMatches: string;
	};

	// Help panel
	help: {
		navigation: string;
		actions: string;
		modes: string;
		enterSubmit: string;
		upDownHistory: string;
		leftRightCursor: string;
		tabComplete: string;
		ctrlCExit: string;
		slashCommands: string;
		atFiles: string;
		questionHelp: string;
		shiftUpDownMode: string;
		browseUpDown: string;
		pageUpDown: string;
		enterToggle: string;
		eExpand: string;
		cCollapse: string;
	};

	// Commands
	commands: {
		model: {
			name: string;
			description: string;
		};
		tools: {
			name: string;
			description: string;
			list: string;
			listDesc: string;
			refresh: string;
			refreshDesc: string;
			stats: string;
			statsDesc: string;
		};
		compact: {
			name: string;
			description: string;
		};
		new: {
			name: string;
			description: string;
		};
		clear: {
			name: string;
			description: string;
		};
		stop: {
			name: string;
			description: string;
		};
		exit: {
			name: string;
			description: string;
		};
	};

	// Command handler messages
	commandHandler: {
		unknownCommand: string;
		modelSwitched: string;
		sessionCleared: string;
		newSession: string;
		stopSuccess: string;
		stopNone: string;
		compactNotEnough: string;
		compactInProgress: string;
		compactSuccess: string;
		compactFailed: string;
		toolsRefreshing: string;
		toolsRefreshed: string;
	};

	// AI service messages
	ai: {
		notConfigured: string;
		contextWarning: string;
		autoCompacting: string;
		fileTruncated: string;
		streamError: string;
		toolExecuting: string;
		toolSuccess: string;
		toolError: string;
	};

	// Message output
	messageOutput: {
		scrollUp: string;
		scrollDown: string;
		moreAbove: string;
		moreBelow: string;
		collapsed: string;
		linesCount: string;
	};

	// Errors
	errors: {
		fileNotFound: string;
		readError: string;
		parseError: string;
		networkError: string;
		apiError: string;
	};

	// Tool categories
	toolCategories: {
		vcs: string;
		runtime: string;
		shell: string;
		ide: string;
		diff: string;
		container: string;
		build: string;
		database: string;
		other: string;
	};

	// Common
	common: {
		yes: string;
		no: string;
		ok: string;
		cancel: string;
		retry: string;
		loading: string;
		error: string;
		success: string;
		warning: string;
		info: string;
		file: string;
		directory: string;
		installed: string;
		notInstalled: string;
		version: string;
	};
};
