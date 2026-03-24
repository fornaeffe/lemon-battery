<svelte:options runes={false} />

<script lang="ts">
	import { onMount } from 'svelte';
	import {
		INITIAL_LED,
		INITIAL_LEMONS,
		INITIAL_PLATES,
		LED_BODY_RX,
		LED_TERMINAL_OFFSET,
		SNAP_RADIUS,
		VIEW_HEIGHT,
		VIEW_WIDTH,
		WIRE_HANDLE_RADIUS,
		buildCircuits,
		buildPlateTouchMap,
		clamp,
		countReadyPairs,
		distance,
		formatPoints,
		getConnectionById,
		getElectronDots,
		getLedTerminal,
		getPlateBase,
		getPlateById,
		getRenderedEndpoint,
		isPlatePairConnection,
		type Circuit,
		type Connection,
		type DragState,
		type Led,
		type LedTerminal,
		type Lemon,
		type Plate,
		type Point,
		type SnapTarget
	} from '$lib/lemon-battery';

	let svgEl: SVGSVGElement;
	let animationTime = 0;
	let dragState: DragState | null = null;
	let hoverTarget: SnapTarget | null = null;
	let connectionCount = 0;

	let lemons: Lemon[] = INITIAL_LEMONS.map((lemon) => ({ ...lemon }));
	let plates: Plate[] = INITIAL_PLATES.map((plate) => ({ ...plate }));
	let led: Led = { ...INITIAL_LED };
	let connections: Connection[] = [];

	let plateTouchById: Record<string, string | null> = {};
	let circuits: Circuit[] = [];
	let energizedLemons = new Set<string>();
	let energizedPlates = new Set<string>();
	let readyPairCount = 0;
	let insertedPlateCount = 0;
	let ledCellCount = 0;
	let ledPower = 0;
	let ledIsOn = false;
	let statusTitle = 'Circuito aperto';
	let statusText =
		'Trascina una lamina di zinco e una di rame nello stesso limone, poi chiudi il percorso con i fili.';

	$: plateTouchById = buildPlateTouchMap(plates, lemons);
	$: circuits = buildCircuits(connections, plates, lemons, led, plateTouchById);
	$: energizedLemons = new Set(circuits.flatMap((circuit) => circuit.lemonIds));
	$: energizedPlates = new Set(circuits.flatMap((circuit) => circuit.plateIds));
	$: readyPairCount = countReadyPairs(lemons, plates, plateTouchById);
	$: insertedPlateCount = Object.values(plateTouchById).filter(Boolean).length;
	$: ledCellCount = Math.max(
		0,
		...circuits.filter((circuit) => circuit.kind === 'led').map((circuit) => circuit.cellCount)
	);
	$: ledPower = Math.max(
		0,
		...circuits.filter((circuit) => circuit.kind === 'led').map((circuit) => circuit.power)
	);
	$: ledIsOn = ledCellCount > 0;
	$: {
		if (ledIsOn && ledCellCount > 1) {
			statusTitle = 'Led brillante';
			statusText = `${ledCellCount} limoni in serie stanno spingendo il circuito: il led si accende di piu e gli elettroni corrono piu veloci.`;
		} else if (ledIsOn) {
			statusTitle = 'Led acceso';
			statusText =
				'Percorso chiuso: il led e nel circuito e gli elettroni scorrono grazie alla cella del limone.';
		} else if (circuits.length > 0) {
			statusTitle = 'Circuito chiuso';
			statusText =
				'Gli elettroni stanno correndo sui fili. Prova a inserire il led fra le due lamine.';
		} else if (readyPairCount > 0) {
			statusTitle = 'Quasi pronto';
			statusText =
				readyPairCount > 1
					? 'Hai gia piu celle pronte: collega lo zinco di un limone al rame del successivo e chiudi il led ai due estremi.'
					: 'Le due lamine toccano lo stesso limone: ora aggancia i fili tra loro o ai terminali del led.';
		} else if (insertedPlateCount > 0) {
			statusTitle = 'Manca un metallo';
			statusText =
				'Serve una coppia Zn-Cu nello stesso limone: trascina dentro anche la lamina dell’altro metallo.';
			statusText =
				'Serve una coppia Zn-Cu nello stesso limone: trascina dentro anche la lamina dell altro metallo.';
		} else {
			statusTitle = 'Circuito aperto';
			statusText =
				'Trascina una lamina di zinco e una di rame nello stesso limone, poi chiudi il percorso con i fili.';
		}
	}

	onMount(() => {
		let frameId = 0;

		const tick = (now: number) => {
			animationTime = now / 1000;
			frameId = requestAnimationFrame(tick);
		};

		frameId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frameId);
	});

	function getSvgPoint(event: PointerEvent): Point {
		const rect = svgEl.getBoundingClientRect();

		return {
			x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
			y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT
		};
	}

	function nextConnectionId() {
		connectionCount += 1;
		return `connection-${connectionCount}`;
	}

	function setPlatePosition(id: string, x: number, y: number) {
		const index = plates.findIndex((plate) => plate.id === id);
		if (index < 0) return;
		plates[index] = { ...plates[index], x, y };
		plates = [...plates];
	}

	function setPlateEndpoint(id: string, point: Point) {
		const index = plates.findIndex((plate) => plate.id === id);
		if (index < 0) return;
		plates[index] = { ...plates[index], endpointX: point.x, endpointY: point.y };
		plates = [...plates];
	}

	function disconnectPlate(plateId: string) {
		const plate = getPlateById(plates, plateId);
		if (!plate?.connectionId) return;

		const renderedEndpoint = getRenderedEndpoint(plate, connections, led);
		const connection = getConnectionById(connections, plate.connectionId);

		if (!connection) {
			setPlateEndpoint(plateId, renderedEndpoint);
			plates = plates.map((item) =>
				item.id === plateId ? { ...item, connectionId: undefined } : item
			);
			return;
		}

		if (connection.kind === 'plate-pair') {
			for (const id of connection.plateIds) {
				plates = plates.map((item) =>
					item.id === id
						? {
								...item,
								connectionId: undefined,
								endpointX: connection.x,
								endpointY: connection.y
							}
						: item
				);
			}
		} else {
			plates = plates.map((item) =>
				item.id === plateId
					? {
							...item,
							connectionId: undefined,
							endpointX: renderedEndpoint.x,
							endpointY: renderedEndpoint.y
						}
					: item
			);
		}

		connections = connections.filter((item) => item.id !== connection.id);
	}

	function isTerminalFree(terminal: LedTerminal) {
		return !connections.some(
			(connection) => connection.kind === 'plate-led' && connection.terminal === terminal
		);
	}

	function connectPlates(sourceId: string, targetId: string, point: Point) {
		const source = getPlateById(plates, sourceId);
		const target = getPlateById(plates, targetId);
		if (!source || !target || source.connectionId || target.connectionId) return;

		const connectionId = nextConnectionId();
		connections = [
			...connections,
			{ id: connectionId, kind: 'plate-pair', plateIds: [sourceId, targetId], x: point.x, y: point.y }
		];

		plates = plates.map((plate) =>
			plate.id === sourceId || plate.id === targetId ? { ...plate, connectionId } : plate
		);
	}

	function connectPlateToLed(sourceId: string, terminal: LedTerminal) {
		const source = getPlateById(plates, sourceId);
		if (!source || source.connectionId || !isTerminalFree(terminal)) return;

		const connectionId = nextConnectionId();
		connections = [...connections, { id: connectionId, kind: 'plate-led', plateId: sourceId, terminal }];
		plates = plates.map((plate) => (plate.id === sourceId ? { ...plate, connectionId } : plate));
	}

	function findSnapTarget(sourceId: string, point: Point) {
		const candidates: SnapTarget[] = [];

		for (const plate of plates) {
			if (plate.id === sourceId || plate.connectionId) continue;
			const endpoint = getRenderedEndpoint(plate, connections, led);
			const candidateDistance = distance(point, endpoint);

			if (candidateDistance <= SNAP_RADIUS) {
				candidates.push({
					kind: 'plate',
					plateId: plate.id,
					x: endpoint.x,
					y: endpoint.y,
					distance: candidateDistance
				});
			}
		}

		for (const terminal of ['left', 'right'] as const) {
			if (!isTerminalFree(terminal)) continue;
			const terminalPoint = getLedTerminal(led, terminal);
			const candidateDistance = distance(point, terminalPoint);

			if (candidateDistance <= SNAP_RADIUS) {
				candidates.push({
					kind: 'led',
					terminal,
					x: terminalPoint.x,
					y: terminalPoint.y,
					distance: candidateDistance
				});
			}
		}

		return candidates.sort((a, b) => a.distance - b.distance)[0] ?? null;
	}

	function beginLemonDrag(id: string, event: PointerEvent) {
		event.stopPropagation();
		event.preventDefault();

		const lemon = lemons.find((item) => item.id === id);
		if (!lemon) return;

		const point = getSvgPoint(event);
		dragState = { kind: 'lemon', id, offsetX: point.x - lemon.x, offsetY: point.y - lemon.y };
	}

	function beginPlateDrag(id: string, event: PointerEvent) {
		event.stopPropagation();
		event.preventDefault();

		const plate = getPlateById(plates, id);
		if (!plate) return;

		const point = getSvgPoint(event);
		dragState = { kind: 'plate', id, offsetX: point.x - plate.x, offsetY: point.y - plate.y };
	}

	function beginLedDrag(event: PointerEvent) {
		event.stopPropagation();
		event.preventDefault();

		const point = getSvgPoint(event);
		dragState = { kind: 'led', offsetX: point.x - led.x, offsetY: point.y - led.y };
	}

	function beginWireDrag(plateId: string, event: PointerEvent) {
		event.stopPropagation();
		event.preventDefault();

		const point = getSvgPoint(event);
		disconnectPlate(plateId);
		setPlateEndpoint(plateId, point);
		hoverTarget = findSnapTarget(plateId, point);
		dragState = { kind: 'wire', plateId };
	}

	function handlePointerMove(event: PointerEvent) {
		const activeDrag = dragState;
		if (!activeDrag) return;

		const point = getSvgPoint(event);

		if (activeDrag.kind === 'lemon') {
			const index = lemons.findIndex((lemon) => lemon.id === activeDrag.id);
			if (index < 0) return;
			const lemon = lemons[index];
			lemons[index] = {
				...lemon,
				x: clamp(point.x - activeDrag.offsetX, lemon.rx + 26, VIEW_WIDTH - lemon.rx - 26),
				y: clamp(point.y - activeDrag.offsetY, 328, VIEW_HEIGHT - lemon.ry - 30)
			};
			lemons = [...lemons];
			return;
		}

		if (activeDrag.kind === 'plate') {
			const plate = getPlateById(plates, activeDrag.id);
			if (!plate) return;
			setPlatePosition(
				activeDrag.id,
				clamp(point.x - activeDrag.offsetX, 24, VIEW_WIDTH - plate.width - 24),
				clamp(point.y - activeDrag.offsetY, 92, VIEW_HEIGHT - plate.height - 20)
			);
			return;
		}

		if (activeDrag.kind === 'led') {
			led = {
				...led,
				x: clamp(point.x - activeDrag.offsetX, LED_BODY_RX + LED_TERMINAL_OFFSET + 12, VIEW_WIDTH - LED_BODY_RX - LED_TERMINAL_OFFSET - 12),
				y: clamp(point.y - activeDrag.offsetY, 120, VIEW_HEIGHT - 140)
			};
			return;
		}

		const endpoint = {
			x: clamp(point.x, 24, VIEW_WIDTH - 24),
			y: clamp(point.y, 32, VIEW_HEIGHT - 24)
		};

		setPlateEndpoint(activeDrag.plateId, endpoint);
		hoverTarget = findSnapTarget(activeDrag.plateId, endpoint);
	}

	function handlePointerUp() {
		if (dragState?.kind === 'wire') {
			const plate = getPlateById(plates, dragState.plateId);
			if (plate) {
				const endpoint = getRenderedEndpoint(plate, connections, led);
				const target = findSnapTarget(dragState.plateId, endpoint);
				if (target?.kind === 'plate') connectPlates(dragState.plateId, target.plateId, target);
				if (target?.kind === 'led') connectPlateToLed(dragState.plateId, target.terminal);
			}
		}

		hoverTarget = null;
		dragState = null;
	}
</script>

<svelte:head>
	<title>Lemon Battery Lab</title>
	<meta
		name="description"
		content="Simulazione interattiva di una pila al limone con limoni, lamine di zinco e rame, fili e led."
	/>
</svelte:head>

<svelte:window
	on:pointermove={handlePointerMove}
	on:pointerup={handlePointerUp}
	on:pointercancel={handlePointerUp}
/>

<main class="page">
	<section class="hero">
		<div class="hero-copy">
			<p class="eyebrow">One-page SvelteKit experiment</p>
			<h1>Pila al limone</h1>
			<p class="lede">
				Muovi i pezzi sul banco, inserisci una lamina di zinco e una di rame nello stesso limone,
				poi trascina i capi-filo per chiudere il circuito. Se colleghi piu limoni in serie, il led
				diventa piu luminoso e gli elettroni accelerano.
			</p>
		</div>

		<div class:live={ledIsOn} class="status-card">
			<p class="status-label">{statusTitle}</p>
			<p class="status-body">{statusText}</p>
			<div class="status-meta">
				<span>{circuits.length} circuiti chiusi</span>
				<span>{energizedLemons.size} limoni attivi</span>
				<span>{ledCellCount} celle sul led</span>
			</div>
		</div>
	</section>

	<section class="scene-shell">
		<div class="scene-frame">
			<svg
				bind:this={svgEl}
				class="scene"
				viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
				role="img"
				aria-label="Banco di prova con limoni, lamine di zinco e rame, fili trascinabili e un led."
			>
				<defs>
					<linearGradient id="boardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#fff8e4" />
						<stop offset="45%" stop-color="#fff1c7" />
						<stop offset="100%" stop-color="#f2dfb4" />
					</linearGradient>
					<pattern id="boardPattern" width="48" height="48" patternUnits="userSpaceOnUse">
						<path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(28, 55, 78, 0.07)" stroke-width="1" />
					</pattern>
					<linearGradient id="lemonSkin" x1="15%" y1="10%" x2="85%" y2="90%">
						<stop offset="0%" stop-color="#fff07a" />
						<stop offset="45%" stop-color="#ffd438" />
						<stop offset="100%" stop-color="#f2b204" />
					</linearGradient>
					<linearGradient id="zincPlate" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#f8fbff" />
						<stop offset="45%" stop-color="#dbe5f6" />
						<stop offset="100%" stop-color="#90a2c2" />
					</linearGradient>
					<linearGradient id="copperPlate" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#ffe1bf" />
						<stop offset="45%" stop-color="#dd955e" />
						<stop offset="100%" stop-color="#a95429" />
					</linearGradient>
					<linearGradient id="wireGradient" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#355c88" />
						<stop offset="100%" stop-color="#20354d" />
					</linearGradient>
					<linearGradient id="ledBody" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stop-color="#fff3b1" />
						<stop offset="50%" stop-color="#ffcb56" />
						<stop offset="100%" stop-color="#f47b14" />
					</linearGradient>
					<filter id="softShadow" x="-30%" y="-30%" width="160%" height="180%">
						<feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#0e1520" flood-opacity="0.18" />
					</filter>
					<filter id="panelShadow" x="-30%" y="-30%" width="160%" height="180%">
						<feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#05111a" flood-opacity="0.28" />
					</filter>
					<filter id="ledGlow" x="-70%" y="-100%" width="240%" height="280%">
						<feDropShadow dx="0" dy="0" stdDeviation="16" flood-color="#ffe474" flood-opacity="1" />
						<feDropShadow dx="0" dy="0" stdDeviation="38" flood-color="#ffc73d" flood-opacity="0.58" />
					</filter>
					<filter id="flowGlow" x="-60%" y="-60%" width="220%" height="220%">
						<feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#89fbff" flood-opacity="0.9" />
					</filter>
				</defs>

				<rect x="18" y="18" width="1164" height="784" rx="38" class="board-shadow" />
				<rect x="28" y="28" width="1144" height="764" rx="32" fill="url(#boardGradient)" filter="url(#panelShadow)" />
				<rect x="28" y="28" width="1144" height="764" rx="32" fill="url(#boardPattern)" opacity="0.9" />

				<g class="board-labels">
					<text x="78" y="92">Banco di prova</text>
					<text x="78" y="124" class="board-subtitle">Trascina gli oggetti e chiudi il circuito</text>
					<text x="855" y="92" class="board-chip">Zn = zinco</text>
					<text x="980" y="92" class="board-chip warm">Cu = rame</text>
				</g>

				{#each lemons as lemon (lemon.id)}
					{@const active = energizedLemons.has(lemon.id)}
					<ellipse cx={lemon.x} cy={lemon.y + lemon.ry + 30} rx={lemon.rx * 0.92} ry="28" class="shadow-oval" />
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<g
						class:active-lemon={active}
						class="lemon"
						transform={`translate(${lemon.x} ${lemon.y}) rotate(${lemon.rotation})`}
						on:pointerdown={(event) => beginLemonDrag(lemon.id, event)}
					>
						<ellipse class="grab-area" cx="0" cy="0" rx={lemon.rx * 1.08} ry={lemon.ry * 1.14} />
						{#if active}
							<ellipse class="lemon-ring" cx="0" cy="0" rx={lemon.rx + 18} ry={lemon.ry + 18} />
						{/if}
						<ellipse class="lemon-body" cx="0" cy="0" rx={lemon.rx} ry={lemon.ry} filter="url(#softShadow)" />
						<ellipse class="lemon-gloss" cx="-26" cy="-18" rx={lemon.rx * 0.35} ry={lemon.ry * 0.22} />
						<ellipse class="lemon-shadow" cx="18" cy="14" rx={lemon.rx * 0.72} ry={lemon.ry * 0.66} />
						<path class="lemon-stem" d="M -4 -78 C 2 -98, 18 -112, 36 -116" />
						<path class="lemon-leaf" d="M 34 -118 C 64 -132, 86 -118, 78 -92 C 58 -80, 40 -92, 34 -118 Z" />
						<circle class="lemon-pore" cx="-54" cy="-2" r="3.6" />
						<circle class="lemon-pore" cx="6" cy="18" r="3.1" />
						<circle class="lemon-pore" cx="44" cy="-16" r="2.8" />
					</g>
				{/each}

				{#each plates as plate (plate.id)}
					{@const base = getPlateBase(plate)}
					{@const endpoint = getRenderedEndpoint(plate, connections, led)}
					<g class="wire-group">
						<line
							x1={base.x}
							y1={base.y}
							x2={endpoint.x}
							y2={endpoint.y}
							class:energized-wire={energizedPlates.has(plate.id)}
							class="wire"
						/>
						<circle cx={base.x} cy={base.y} r="7" class="wire-anchor" />
					</g>
				{/each}

				{#each plates as plate (plate.id)}
					{@const inserted = Boolean(plateTouchById[plate.id])}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<g
						class={`plate ${plate.metal}`}
						class:inserted-plate={inserted}
						transform={`translate(${plate.x} ${plate.y})`}
						on:pointerdown={(event) => beginPlateDrag(plate.id, event)}
					>
						<rect class="grab-area" x="-16" y="-24" width={plate.width + 32} height={plate.height + 40} rx="18" />
						<rect class="plate-body" width={plate.width} height={plate.height} rx="12" />
						<rect class="plate-gloss" x="3" y="6" width="6" height={plate.height - 12} rx="4" />
						<rect class="plate-top-band" x="4" y="10" width={plate.width - 8} height="18" rx="7" />
						<text class="plate-label" x={plate.width / 2} y={plate.height / 2 + 12}>{plate.label}</text>
					</g>
				{/each}

				<g class="connection-layer">
					{#each connections.filter(isPlatePairConnection) as connection (connection.id)}
						<circle class="junction" cx={connection.x} cy={connection.y} r="8" />
					{/each}
				</g>

				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<g
					class:led-on={ledIsOn}
					class="led"
					style={`--led-power: ${ledPower};`}
					transform={`translate(${led.x} ${led.y})`}
					on:pointerdown={beginLedDrag}
					filter={ledIsOn ? 'url(#ledGlow)' : undefined}
				>
					<rect class="grab-area" x="-156" y="-66" width="312" height="132" rx="30" />
					{#if ledIsOn}
						<ellipse
							class="led-aura"
							cx="0"
							cy="8"
							rx={92 + ledPower * 22}
							ry={56 + ledPower * 12}
							style={`opacity: ${0.26 + ledPower * 0.48};`}
						/>
					{/if}
					<line x1={-LED_TERMINAL_OFFSET} y1="8" x2={-LED_BODY_RX - 6} y2="8" class="led-pin" />
					<line x1={LED_BODY_RX + 6} y1="8" x2={LED_TERMINAL_OFFSET} y2="8" class="led-pin" />
					<circle cx={-LED_TERMINAL_OFFSET} cy="8" r="8" class="led-terminal" />
					<circle cx={LED_TERMINAL_OFFSET} cy="8" r="8" class="led-terminal" />
					<path
						class="led-cap"
						style={`stroke-width: ${3 + ledPower * 1.1};`}
						d={`M ${-LED_BODY_RX} 8 C ${-LED_BODY_RX + 6} -34, ${LED_BODY_RX - 22} -34, ${LED_BODY_RX - 6} 8
							C ${LED_BODY_RX + 2} 34, ${-LED_BODY_RX - 10} 34, ${-LED_BODY_RX} 8 Z`}
					/>
					<ellipse
						cx="0"
						cy="4"
						rx="44"
						ry="26"
						class="led-core"
						style={`opacity: ${0.55 + ledPower * 0.36};`}
					/>
					<path
						class="led-icon"
						style={`opacity: ${0.72 + ledPower * 0.18};`}
						d="M -24 8 L -4 -16 L -4 -2 L 22 -2 L -2 28 L -2 14 L -24 14 Z"
					/>
				</g>

				<g class="flow-layer">
					{#each circuits as circuit (circuit.id)}
						{#each circuit.flowSegments as segment, segmentIndex (`${circuit.id}-${segmentIndex}`)}
							<polyline
								points={formatPoints(segment)}
								class:led-flow={circuit.kind === 'led'}
								class="flow-path"
								style={`stroke-width: ${4.4 + circuit.power * 1.4}; opacity: ${0.72 + circuit.power * 0.18};`}
								filter="url(#flowGlow)"
							/>
						{/each}
						{#each getElectronDots(circuit, animationTime) as electron (electron.id)}
							<circle
								cx={electron.x}
								cy={electron.y}
								r={electron.size}
								class="electron"
								style={`opacity: ${0.82 + circuit.power * 0.12};`}
								filter="url(#flowGlow)"
							/>
						{/each}
					{/each}
				</g>

				{#if hoverTarget}
					<circle
						cx={hoverTarget.x}
						cy={hoverTarget.y}
						r="22"
						class:led-hover={hoverTarget.kind === 'led'}
						class="snap-halo"
					/>
				{/if}

				{#each plates as plate (plate.id)}
					{@const endpoint = getRenderedEndpoint(plate, connections, led)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<g class="handle-group" on:pointerdown={(event) => beginWireDrag(plate.id, event)}>
						<circle cx={endpoint.x} cy={endpoint.y} r={WIRE_HANDLE_RADIUS + 8} class="grab-area" />
						<circle
							cx={endpoint.x}
							cy={endpoint.y}
							r={WIRE_HANDLE_RADIUS}
							class:energized-handle={energizedPlates.has(plate.id)}
							class="wire-handle"
						/>
						<circle cx={endpoint.x} cy={endpoint.y} r="5" class="wire-handle-core" />
					</g>
				{/each}
			</svg>
		</div>

		<div class="instruction-grid">
			<article class="instruction-card">
				<p class="instruction-step">1</p>
				<h2>Inserisci le lamine</h2>
				<p>Trascina una Zn e una Cu nello stesso limone finche sembrano infilate nella polpa.</p>
			</article>

			<article class="instruction-card">
				<p class="instruction-step">2</p>
				<h2>Chiudi il circuito</h2>
				<p>Afferra il capo-filo in alto: puoi chiudere un solo limone oppure mettere piu celle in serie collegando Zn e Cu di limoni vicini.</p>
			</article>

			<article class="instruction-card">
				<p class="instruction-step">3</p>
				<h2>Osserva gli elettroni</h2>
				<p>Quando il percorso e corretto, i pallini scorrono lungo i fili; con piu limoni in serie il led brilla di piu.</p>
			</article>
		</div>
	</section>
</main>

<style>
	:global(:root) {
		--ink: #14212d;
		--panel-border: rgba(255, 247, 214, 0.2);
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		min-height: 100vh;
		color: #fff6db;
		background:
			radial-gradient(circle at 18% 10%, rgba(255, 228, 112, 0.28), transparent 22%),
			radial-gradient(circle at 82% 16%, rgba(105, 225, 255, 0.18), transparent 24%),
			linear-gradient(180deg, #132633 0%, #0a151c 72%, #081118 100%);
		font-family: 'Trebuchet MS', 'Gill Sans', 'Segoe UI', sans-serif;
	}

	.page {
		width: min(1180px, calc(100vw - 28px));
		margin: 0 auto;
		padding: 28px 0 42px;
	}

	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
		gap: 24px;
		align-items: start;
		margin-bottom: 24px;
	}

	.hero-copy,
	.status-card,
	.scene-shell {
		backdrop-filter: blur(18px);
	}

	.hero-copy,
	.status-card {
		padding: 24px 26px;
		border-radius: 24px;
		border: 1px solid var(--panel-border);
		background:
			linear-gradient(180deg, rgba(255, 252, 242, 0.12), rgba(255, 255, 255, 0.03)),
			rgba(8, 21, 29, 0.38);
		box-shadow: 0 24px 50px rgba(2, 11, 16, 0.28);
	}

	.eyebrow {
		margin: 0 0 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		font-size: 0.76rem;
		color: #9eeeff;
	}

	h1 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(2.6rem, 4vw, 4.4rem);
		line-height: 0.95;
		letter-spacing: -0.04em;
		color: #fff7cc;
	}

	.lede {
		margin: 16px 0 0;
		max-width: 62ch;
		font-size: 1.03rem;
		line-height: 1.6;
		color: rgba(255, 247, 214, 0.88);
	}

	.status-card {
		align-self: stretch;
		display: grid;
		gap: 12px;
		transition:
			transform 240ms ease,
			box-shadow 240ms ease,
			background 240ms ease;
	}

	.status-card.live {
		background:
			linear-gradient(180deg, rgba(255, 238, 183, 0.18), rgba(255, 255, 255, 0.05)),
			rgba(8, 21, 29, 0.42);
		box-shadow:
			0 0 0 1px rgba(255, 228, 116, 0.2),
			0 30px 58px rgba(2, 11, 16, 0.32);
		transform: translateY(-2px);
	}

	.status-label {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		color: #fff1b4;
	}

	.status-body {
		margin: 0;
		line-height: 1.55;
		color: rgba(255, 247, 214, 0.88);
	}

	.status-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		font-size: 0.85rem;
		color: rgba(255, 247, 214, 0.76);
	}

	.status-meta span {
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.scene-shell {
		padding: 18px;
		border-radius: 34px;
		border: 1px solid rgba(255, 252, 236, 0.12);
		background:
			linear-gradient(180deg, rgba(255, 252, 242, 0.08), rgba(255, 255, 255, 0.02)),
			rgba(7, 18, 26, 0.44);
		box-shadow: 0 34px 62px rgba(2, 11, 16, 0.32);
	}

	.scene-frame {
		position: relative;
		border-radius: 28px;
		overflow: hidden;
		background: rgba(255, 248, 228, 0.04);
	}

	.scene {
		display: block;
		width: 100%;
		height: auto;
		touch-action: none;
		user-select: none;
	}

	.board-shadow {
		fill: rgba(8, 18, 25, 0.16);
	}

	.board-labels text {
		font-family: Georgia, 'Times New Roman', serif;
		fill: rgba(24, 38, 54, 0.94);
	}

	.board-labels .board-subtitle {
		font-family: 'Trebuchet MS', 'Gill Sans', 'Segoe UI', sans-serif;
		font-size: 17px;
		fill: rgba(24, 38, 54, 0.68);
	}

	.board-chip {
		font-family: 'Trebuchet MS', 'Gill Sans', 'Segoe UI', sans-serif;
		font-size: 15px;
		font-weight: 700;
		fill: #647790;
	}

	.board-chip.warm {
		fill: #ae5e32;
	}

	.shadow-oval {
		fill: rgba(40, 28, 14, 0.12);
		filter: blur(10px);
	}

	.grab-area {
		fill: transparent;
		cursor: grab;
	}

	.lemon-ring {
		fill: none;
		stroke: rgba(122, 243, 255, 0.72);
		stroke-width: 8;
		stroke-linecap: round;
		stroke-dasharray: 16 14;
		animation: ring-dash 14s linear infinite;
	}

	.lemon-body {
		fill: url(#lemonSkin);
		stroke: #d08b03;
		stroke-width: 3.5;
	}

	.lemon-gloss {
		fill: rgba(255, 255, 255, 0.34);
	}

	.lemon-shadow {
		fill: rgba(211, 125, 4, 0.16);
	}

	.lemon-stem {
		fill: none;
		stroke: #6e5720;
		stroke-width: 5;
		stroke-linecap: round;
	}

	.lemon-leaf {
		fill: #77b85a;
		stroke: #3b7c2f;
		stroke-width: 3;
	}

	.lemon-pore {
		fill: rgba(214, 148, 4, 0.5);
	}

	.wire {
		stroke: url(#wireGradient);
		stroke-width: 6;
		stroke-linecap: round;
	}

	.energized-wire {
		stroke: #76f7ff;
		stroke-width: 7;
	}

	.wire-anchor {
		fill: #29476c;
		stroke: rgba(255, 255, 255, 0.6);
		stroke-width: 2;
	}

	.plate-body {
		stroke-width: 2.5;
	}

	.plate.zinc .plate-body {
		fill: url(#zincPlate);
		stroke: #65748f;
	}

	.plate.copper .plate-body {
		fill: url(#copperPlate);
		stroke: #834524;
	}

	.plate-gloss {
		fill: rgba(255, 255, 255, 0.35);
	}

	.plate-top-band {
		fill: rgba(255, 255, 255, 0.18);
	}

	.plate-label {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 22px;
		font-weight: 700;
		text-anchor: middle;
		fill: rgba(16, 26, 39, 0.82);
		pointer-events: none;
	}

	.inserted-plate .plate-body {
		stroke-width: 4;
	}

	.plate.zinc.inserted-plate .plate-body {
		stroke: #6ae7ff;
	}

	.plate.copper.inserted-plate .plate-body {
		stroke: #ffde7e;
	}

	.junction {
		fill: #20364d;
		stroke: #e8f8ff;
		stroke-width: 2.5;
	}

	.led-pin {
		stroke: #647a92;
		stroke-width: 6;
		stroke-linecap: round;
	}

	.led-terminal {
		fill: #35506a;
		stroke: #effaff;
		stroke-width: 2.5;
	}

	.led-aura {
		fill: rgba(255, 213, 105, 0.58);
		filter: blur(18px);
		pointer-events: none;
	}

	.led-cap {
		fill: url(#ledBody);
		stroke: #b55a14;
		stroke-width: 3;
	}

	.led-core {
		fill: rgba(255, 252, 212, 0.55);
	}

	.led-icon {
		fill: rgba(255, 255, 255, 0.72);
	}

	.led-on .led-cap {
		stroke: #ffd66c;
	}

	.flow-path {
		fill: none;
		stroke: rgba(122, 243, 255, 0.9);
		stroke-width: 4.5;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-dasharray: 14 12;
		animation: flow-dash 1.4s linear infinite;
	}

	.flow-path.led-flow {
		stroke: rgba(255, 227, 107, 0.95);
	}

	.electron {
		fill: #f6ffff;
		stroke: rgba(122, 243, 255, 0.95);
		stroke-width: 1.6;
	}

	.snap-halo {
		fill: rgba(122, 243, 255, 0.12);
		stroke: rgba(122, 243, 255, 0.9);
		stroke-width: 3;
		stroke-dasharray: 8 8;
		animation: ring-dash 4s linear infinite;
	}

	.snap-halo.led-hover {
		fill: rgba(255, 227, 107, 0.16);
		stroke: rgba(255, 227, 107, 0.95);
	}

	.wire-handle {
		fill: #2b4d74;
		stroke: rgba(255, 255, 255, 0.82);
		stroke-width: 2;
	}

	.energized-handle {
		fill: #52d6ff;
		stroke: #ffffff;
	}

	.wire-handle-core {
		fill: #effcff;
		pointer-events: none;
	}

	.instruction-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16px;
		margin-top: 18px;
	}

	.instruction-card {
		padding: 18px 18px 20px;
		border-radius: 22px;
		border: 1px solid rgba(255, 247, 214, 0.08);
		background: rgba(255, 250, 238, 0.07);
	}

	.instruction-card h2 {
		margin: 0 0 8px;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.25rem;
		color: #fff4c0;
	}

	.instruction-card p {
		margin: 0;
		line-height: 1.55;
		color: rgba(255, 247, 214, 0.82);
	}

	.instruction-step {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		margin-bottom: 12px;
		border-radius: 999px;
		background: linear-gradient(180deg, #fff0a3, #f9bb2c);
		color: #172433;
		font-weight: 800;
	}

	@keyframes ring-dash {
		from {
			stroke-dashoffset: 0;
		}

		to {
			stroke-dashoffset: -120;
		}
	}

	@keyframes flow-dash {
		from {
			stroke-dashoffset: 0;
		}

		to {
			stroke-dashoffset: -104;
		}
	}

	@media (max-width: 960px) {
		.hero {
			grid-template-columns: 1fr;
		}

		.instruction-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.page {
			width: min(100vw - 16px, 1180px);
			padding: 12px 0 22px;
		}

		.hero-copy,
		.status-card,
		.scene-shell {
			padding-left: 16px;
			padding-right: 16px;
		}

		.scene-shell {
			padding-top: 14px;
			padding-bottom: 14px;
		}

		.lede {
			font-size: 0.97rem;
		}
	}
</style>
