export type Point = {
	x: number;
	y: number;
};

export type Metal = 'zinc' | 'copper';
export type LedTerminal = 'left' | 'right';

export type Lemon = Point & {
	id: string;
	rx: number;
	ry: number;
	rotation: number;
};

export type Plate = Point & {
	id: string;
	label: string;
	metal: Metal;
	width: number;
	height: number;
	endpointX: number;
	endpointY: number;
	connectionId?: string;
};

export type Led = Point & {
	id: string;
};

export type PlatePairConnection = {
	id: string;
	kind: 'plate-pair';
	plateIds: [string, string];
	x: number;
	y: number;
};

export type PlateLedConnection = {
	id: string;
	kind: 'plate-led';
	plateId: string;
	terminal: LedTerminal;
};

export type Connection = PlatePairConnection | PlateLedConnection;

export type DragState =
	| { kind: 'lemon'; id: string; offsetX: number; offsetY: number }
	| { kind: 'plate'; id: string; offsetX: number; offsetY: number }
	| { kind: 'led'; offsetX: number; offsetY: number }
	| { kind: 'wire'; plateId: string };

export type SnapTarget =
	| { kind: 'plate'; plateId: string; x: number; y: number; distance: number }
	| { kind: 'led'; terminal: LedTerminal; x: number; y: number; distance: number };

export type Circuit = {
	id: string;
	kind: 'direct' | 'led';
	cellCount: number;
	power: number;
	lemonIds: string[];
	plateIds: string[];
	flowSegments: Point[][];
};

export type ElectronDot = Point & {
	id: string;
	size: number;
};

type NetworkEdge = {
	id: string;
	kind: 'wire' | 'cell';
	nodeIds: [string, string];
	points: Point[];
	lemonId?: string;
};

type PathStep = {
	edge: NetworkEdge;
	from: string;
	to: string;
};

type SeriesPath = {
	steps: PathStep[];
	cellCount: number;
	lemonIds: string[];
	plateIds: string[];
	startPlateId: string;
	endPlateId: string;
};

const LED_LEFT_NODE = '__led:left';
const LED_RIGHT_NODE = '__led:right';

export const VIEW_WIDTH = 1200;
export const VIEW_HEIGHT = 820;
export const PLATE_WIDTH = 28;
export const PLATE_HEIGHT = 174;
export const SNAP_RADIUS = 42;
export const WIRE_HANDLE_RADIUS = 16;
export const LED_BODY_RX = 62;
export const LED_BODY_RY = 38;
export const LED_TERMINAL_OFFSET = 98;

export const INITIAL_LEMONS: Lemon[] = [
	{ id: 'lemon-a', x: 286, y: 560, rx: 108, ry: 80, rotation: -7 },
	{ id: 'lemon-b', x: 602, y: 534, rx: 118, ry: 86, rotation: 5 },
	{ id: 'lemon-c', x: 920, y: 560, rx: 105, ry: 79, rotation: 8 }
];

export const INITIAL_PLATES: Plate[] = [
	{
		id: 'zn-1',
		label: 'Zn',
		metal: 'zinc',
		x: 82,
		y: 128,
		width: PLATE_WIDTH,
		height: PLATE_HEIGHT,
		endpointX: 156,
		endpointY: 82
	},
	{
		id: 'cu-1',
		label: 'Cu',
		metal: 'copper',
		x: 196,
		y: 132,
		width: PLATE_WIDTH,
		height: PLATE_HEIGHT,
		endpointX: 272,
		endpointY: 100
	},
	{
		id: 'zn-2',
		label: 'Zn',
		metal: 'zinc',
		x: 360,
		y: 118,
		width: PLATE_WIDTH,
		height: PLATE_HEIGHT,
		endpointX: 422,
		endpointY: 74
	},
	{
		id: 'cu-2',
		label: 'Cu',
		metal: 'copper',
		x: 476,
		y: 116,
		width: PLATE_WIDTH,
		height: PLATE_HEIGHT,
		endpointX: 550,
		endpointY: 82
	},
	{
		id: 'zn-3',
		label: 'Zn',
		metal: 'zinc',
		x: 760,
		y: 126,
		width: PLATE_WIDTH,
		height: PLATE_HEIGHT,
		endpointX: 824,
		endpointY: 88
	},
	{
		id: 'cu-3',
		label: 'Cu',
		metal: 'copper',
		x: 876,
		y: 130,
		width: PLATE_WIDTH,
		height: PLATE_HEIGHT,
		endpointX: 952,
		endpointY: 104
	}
];

export const INITIAL_LED: Led = {
	id: 'led-main',
	x: 602,
	y: 248
};

export const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const isPlatePairConnection = (
	connection: Connection
): connection is PlatePairConnection => connection.kind === 'plate-pair';

export const isPlateLedConnection = (connection: Connection): connection is PlateLedConnection =>
	connection.kind === 'plate-led';

export function getPlateById(plates: Plate[], id: string) {
	return plates.find((plate) => plate.id === id);
}

export function getConnectionById(connections: Connection[], id?: string) {
	return id ? connections.find((connection) => connection.id === id) : undefined;
}

export function getPlateBase(plate: Plate): Point {
	return {
		x: plate.x + plate.width / 2,
		y: plate.y + 10
	};
}

export function getLedTerminal(led: Led, terminal: LedTerminal): Point {
	return {
		x: led.x + (terminal === 'left' ? -LED_TERMINAL_OFFSET : LED_TERMINAL_OFFSET),
		y: led.y + 8
	};
}

export function getRenderedEndpoint(plate: Plate, connections: Connection[], led: Led): Point {
	const connection = getConnectionById(connections, plate.connectionId);

	if (!connection) {
		return {
			x: plate.endpointX,
			y: plate.endpointY
		};
	}

	if (connection.kind === 'plate-pair') {
		return {
			x: connection.x,
			y: connection.y
		};
	}

	return getLedTerminal(led, connection.terminal);
}

export function getTouchedLemonId(plate: Plate, lemons: Lemon[]) {
	const probe = {
		x: plate.x + plate.width / 2,
		y: plate.y + plate.height * 0.7
	};

	for (const lemon of lemons) {
		const dx = probe.x - lemon.x;
		const dy = probe.y - lemon.y;
		const inside = (dx * dx) / (lemon.rx * lemon.rx) + (dy * dy) / (lemon.ry * lemon.ry);

		if (inside <= 1) {
			return lemon.id;
		}
	}

	return null;
}

export function buildPlateTouchMap(plates: Plate[], lemons: Lemon[]) {
	return Object.fromEntries(
		plates.map((plate) => [plate.id, getTouchedLemonId(plate, lemons)])
	) as Record<string, string | null>;
}

export function countReadyPairs(
	lemons: Lemon[],
	plates: Plate[],
	plateTouchById: Record<string, string | null>
) {
	return lemons.reduce((count, lemon) => {
		let hasZinc = false;
		let hasCopper = false;

		for (const plate of plates) {
			if (plateTouchById[plate.id] !== lemon.id) {
				continue;
			}

			hasZinc ||= plate.metal === 'zinc';
			hasCopper ||= plate.metal === 'copper';
		}

		return hasZinc && hasCopper ? count + 1 : count;
	}, 0);
}

export function getTerminalPlate(
	terminal: LedTerminal,
	connections: Connection[],
	plates: Plate[]
) {
	const connection = connections.find(
		(item): item is PlateLedConnection =>
			item.kind === 'plate-led' && item.terminal === terminal
	);

	return connection ? getPlateById(plates, connection.plateId) : undefined;
}

function isTerminalNode(nodeId: string) {
	return nodeId === LED_LEFT_NODE || nodeId === LED_RIGHT_NODE;
}

function getOtherNode(edge: NetworkEdge, nodeId: string) {
	if (edge.nodeIds[0] === nodeId) {
		return edge.nodeIds[1];
	}

	if (edge.nodeIds[1] === nodeId) {
		return edge.nodeIds[0];
	}

	return null;
}

function orientEdgePoints(edge: NetworkEdge, from: string, to: string) {
	if (edge.nodeIds[0] === from && edge.nodeIds[1] === to) {
		return edge.points;
	}

	return [...edge.points].reverse();
}

function buildFlowSegments(steps: PathStep[]) {
	return steps
		.filter((step) => step.edge.kind === 'wire')
		.map((step) => orientEdgePoints(step.edge, step.from, step.to));
}

function buildNetworkEdges(
	connections: Connection[],
	plates: Plate[],
	lemons: Lemon[],
	led: Led,
	plateTouchById: Record<string, string | null>
) {
	const edges: NetworkEdge[] = [];

	for (const connection of connections) {
		if (connection.kind === 'plate-pair') {
			const first = getPlateById(plates, connection.plateIds[0]);
			const second = getPlateById(plates, connection.plateIds[1]);

			if (!first || !second) {
				continue;
			}

			edges.push({
				id: connection.id,
				kind: 'wire',
				nodeIds: connection.plateIds,
				points: [
					getPlateBase(first),
					{ x: connection.x, y: connection.y },
					getPlateBase(second)
				]
			});
			continue;
		}

		const plate = getPlateById(plates, connection.plateId);

		if (!plate) {
			continue;
		}

		const terminalNode = connection.terminal === 'left' ? LED_LEFT_NODE : LED_RIGHT_NODE;
		edges.push({
			id: connection.id,
			kind: 'wire',
			nodeIds: [plate.id, terminalNode],
			points: [getPlateBase(plate), getLedTerminal(led, connection.terminal)]
		});
	}

	for (const lemon of lemons) {
		const zincPlates = plates.filter(
			(plate) => plate.metal === 'zinc' && plateTouchById[plate.id] === lemon.id
		);
		const copperPlates = plates.filter(
			(plate) => plate.metal === 'copper' && plateTouchById[plate.id] === lemon.id
		);

		for (const copper of copperPlates) {
			for (const zinc of zincPlates) {
				const swing = copper.x <= zinc.x ? 14 : -14;
				edges.push({
					id: `cell:${lemon.id}:${copper.id}:${zinc.id}`,
					kind: 'cell',
					nodeIds: [copper.id, zinc.id],
					lemonId: lemon.id,
					points: [
						getPlateBase(copper),
						{ x: lemon.x - swing, y: lemon.y - lemon.ry * 0.24 },
						{ x: lemon.x + swing, y: lemon.y + lemon.ry * 0.08 },
						getPlateBase(zinc)
					]
				});
			}
		}
	}

	return edges;
}

function getPathPlateIds(steps: PathStep[]) {
	const plateIds: string[] = [];

	for (const step of steps) {
		for (const nodeId of [step.from, step.to]) {
			if (isTerminalNode(nodeId) || plateIds.includes(nodeId)) {
				continue;
			}

			plateIds.push(nodeId);
		}
	}

	return plateIds;
}

function findBestSeriesPath(edges: NetworkEdge[], plates: Plate[]): SeriesPath | null {
	const adjacency = new Map<string, NetworkEdge[]>();

	for (const edge of edges) {
		for (const nodeId of edge.nodeIds) {
			const bucket = adjacency.get(nodeId) ?? [];
			bucket.push(edge);
			adjacency.set(nodeId, bucket);
		}
	}

	let bestPath: SeriesPath | null = null;
	let bestWireLength = Number.POSITIVE_INFINITY;

	function considerPath(steps: PathStep[]) {
		const startPlateId = steps[0]?.to;
		const endPlateId = steps[steps.length - 1]?.from;

		if (!startPlateId || !endPlateId) {
			return;
		}

		const startPlate = getPlateById(plates, startPlateId);
		const endPlate = getPlateById(plates, endPlateId);

		if (!startPlate || !endPlate || startPlate.metal === endPlate.metal) {
			return;
		}

		const lemonIds = Array.from(
			new Set(
				steps
					.filter((step) => step.edge.kind === 'cell' && step.edge.lemonId)
					.map((step) => step.edge.lemonId as string)
			)
		);

		if (lemonIds.length === 0) {
			return;
		}

		const wireLength = steps.reduce(
			(total, step) => total + (step.edge.kind === 'wire' ? getTotalLength(step.edge.points) : 0),
			0
		);

		if (
			bestPath &&
			(bestPath.cellCount > lemonIds.length ||
				(bestPath.cellCount === lemonIds.length && bestWireLength <= wireLength))
		) {
			return;
		}

		bestWireLength = wireLength;
		bestPath = {
			steps: steps.map((step) => ({ ...step })),
			cellCount: lemonIds.length,
			lemonIds,
			plateIds: getPathPlateIds(steps),
			startPlateId,
			endPlateId
		};
	}

	function dfs(
		nodeId: string,
		lastKind: NetworkEdge['kind'] | null,
		steps: PathStep[],
		visitedNodes: Set<string>,
		usedLemons: Set<string>
	) {
		if (nodeId === LED_RIGHT_NODE) {
			if (lastKind === 'wire') {
				considerPath(steps);
			}

			return;
		}

		for (const edge of adjacency.get(nodeId) ?? []) {
			if (lastKind === null && edge.kind !== 'wire') {
				continue;
			}

			if (lastKind === 'wire' && edge.kind !== 'cell') {
				continue;
			}

			if (lastKind === 'cell' && edge.kind !== 'wire') {
				continue;
			}

			const nextNode = getOtherNode(edge, nodeId);

			if (!nextNode) {
				continue;
			}

			if (nextNode !== LED_RIGHT_NODE && visitedNodes.has(nextNode)) {
				continue;
			}

			if (edge.kind === 'cell' && edge.lemonId && usedLemons.has(edge.lemonId)) {
				continue;
			}

			steps.push({ edge, from: nodeId, to: nextNode });

			const addedLemon = edge.kind === 'cell' ? edge.lemonId : undefined;
			const shouldTrackNode = nextNode !== LED_RIGHT_NODE;

			if (addedLemon) {
				usedLemons.add(addedLemon);
			}

			if (shouldTrackNode) {
				visitedNodes.add(nextNode);
			}

			dfs(nextNode, edge.kind, steps, visitedNodes, usedLemons);

			if (shouldTrackNode) {
				visitedNodes.delete(nextNode);
			}

			if (addedLemon) {
				usedLemons.delete(addedLemon);
			}

			steps.pop();
		}
	}

	dfs(LED_LEFT_NODE, null, [], new Set([LED_LEFT_NODE]), new Set());

	return bestPath;
}

function getCircuitPower(kind: Circuit['kind'], cellCount: number) {
	if (kind === 'direct') {
		return 0.52;
	}

	return Math.min(1.2, 0.62 + (cellCount - 1) * 0.24);
}

function buildDirectCircuits(
	connections: Connection[],
	plates: Plate[],
	plateTouchById: Record<string, string | null>
) {
	const circuits: Circuit[] = [];

	for (const connection of connections) {
		if (connection.kind !== 'plate-pair') {
			continue;
		}

		const [firstId, secondId] = connection.plateIds;
		const first = getPlateById(plates, firstId);
		const second = getPlateById(plates, secondId);

		if (!first || !second || first.metal === second.metal) {
			continue;
		}

		const zinc = first.metal === 'zinc' ? first : second;
		const copper = zinc.id === first.id ? second : first;
		const zincLemon = plateTouchById[zinc.id];
		const copperLemon = plateTouchById[copper.id];

		if (!zincLemon || zincLemon !== copperLemon) {
			continue;
		}

		circuits.push({
			id: connection.id,
			kind: 'direct',
			cellCount: 1,
			power: getCircuitPower('direct', 1),
			lemonIds: [zincLemon],
			plateIds: [zinc.id, copper.id],
			flowSegments: [
				[getPlateBase(zinc), { x: connection.x, y: connection.y }, getPlateBase(copper)]
			]
		});
	}

	return circuits;
}

function buildLedCircuit(
	connections: Connection[],
	plates: Plate[],
	lemons: Lemon[],
	led: Led,
	plateTouchById: Record<string, string | null>
): Circuit | null {
	const path: SeriesPath | null = findBestSeriesPath(
		buildNetworkEdges(connections, plates, lemons, led, plateTouchById),
		plates
	);

	if (!path) {
		return null;
	}

	const startPlate = getPlateById(plates, path.startPlateId);
	const endPlate = getPlateById(plates, path.endPlateId);

	if (!startPlate || !endPlate) {
		return null;
	}

	const forwardFlowSegments = buildFlowSegments(path.steps);

	let copperTerminal: LedTerminal;
	let zincTerminal: LedTerminal;
	let networkSegments: Point[][];

	if (startPlate.metal === 'copper' && endPlate.metal === 'zinc') {
		copperTerminal = 'left';
		zincTerminal = 'right';
		networkSegments = forwardFlowSegments;
	} else if (startPlate.metal === 'zinc' && endPlate.metal === 'copper') {
		copperTerminal = 'right';
		zincTerminal = 'left';
		networkSegments = [...forwardFlowSegments].reverse().map((segment) => [...segment].reverse());
	} else {
		return null;
	}

	const zincTerminalPoint = getLedTerminal(led, zincTerminal);
	const copperTerminalPoint = getLedTerminal(led, copperTerminal);

	return {
		id: `led-circuit:${path.plateIds.join(':')}`,
		kind: 'led',
		cellCount: path.cellCount,
		power: getCircuitPower('led', path.cellCount),
		lemonIds: path.lemonIds,
		plateIds: path.plateIds,
		flowSegments: [
			[
				zincTerminalPoint,
				{ x: led.x, y: led.y - LED_BODY_RY * 0.34 },
				{ x: led.x, y: led.y + 4 },
				copperTerminalPoint
			],
			...networkSegments
		]
	};
}

export function buildCircuits(
	connections: Connection[],
	plates: Plate[],
	lemons: Lemon[],
	led: Led,
	plateTouchById: Record<string, string | null>
) {
	const circuits = buildDirectCircuits(connections, plates, plateTouchById);
	const ledCircuit = buildLedCircuit(connections, plates, lemons, led, plateTouchById);

	if (ledCircuit) {
		circuits.push(ledCircuit);
	}

	return circuits;
}

export function formatPoints(points: Point[]) {
	return points.map((point) => `${point.x},${point.y}`).join(' ');
}

export function getTotalLength(points: Point[]) {
	let total = 0;

	for (let index = 1; index < points.length; index += 1) {
		total += distance(points[index - 1], points[index]);
	}

	return total;
}

export function pointAlongPolyline(points: Point[], travel: number) {
	let remaining = travel;

	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1];
		const end = points[index];
		const segmentLength = distance(start, end);

		if (segmentLength === 0) {
			continue;
		}

		if (remaining <= segmentLength) {
			const ratio = remaining / segmentLength;
			return {
				x: start.x + (end.x - start.x) * ratio,
				y: start.y + (end.y - start.y) * ratio
			};
		}

		remaining -= segmentLength;
	}

	return points[points.length - 1];
}

export function getElectronDots(circuit: Circuit, animationTime: number) {
	const segmentLengths = circuit.flowSegments.map((segment) => getTotalLength(segment));
	const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);

	if (totalLength < 1) {
		return [] as ElectronDot[];
	}

	const extraCells = Math.max(0, circuit.cellCount - 1);
	const speed =
		(circuit.kind === 'led' ? 158 : 138) + extraCells * (circuit.kind === 'led' ? 58 : 34);
	const count = (circuit.kind === 'led' ? 8 : 6) + extraCells * 2;
	const size = 4.1 + circuit.power * 1.1;

	return circuit.flowSegments.flatMap((segment, segmentIndex) => {
		const segmentLength = segmentLengths[segmentIndex];

		if (segmentLength < 1) {
			return [] as ElectronDot[];
		}

		const segmentCount = Math.max(1, Math.round((count * segmentLength) / totalLength));

		return Array.from({ length: segmentCount }, (_, dotIndex) => {
			const travel =
				(animationTime * speed + (dotIndex * segmentLength) / segmentCount + segmentIndex * 17) %
				segmentLength;
			const point = pointAlongPolyline(segment, travel);

			return {
				id: `${circuit.id}-${segmentIndex}-${dotIndex}`,
				x: point.x,
				y: point.y,
				size
			};
		});
	});
}
