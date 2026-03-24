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
	lemonId: string;
	zincId: string;
	copperId: string;
	points: Point[];
};

export type ElectronDot = Point & {
	id: string;
	size: number;
};

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

export function buildCircuits(
	connections: Connection[],
	plates: Plate[],
	led: Led,
	plateTouchById: Record<string, string | null>
) {
	const nextCircuits: Circuit[] = [];

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

		nextCircuits.push({
			id: connection.id,
			kind: 'direct',
			lemonId: zincLemon,
			zincId: zinc.id,
			copperId: copper.id,
			points: [getPlateBase(zinc), { x: connection.x, y: connection.y }, getPlateBase(copper)]
		});
	}

	const leftPlate = getTerminalPlate('left', connections, plates);
	const rightPlate = getTerminalPlate('right', connections, plates);

	if (leftPlate && rightPlate && leftPlate.metal !== rightPlate.metal) {
		const zinc = leftPlate.metal === 'zinc' ? leftPlate : rightPlate;
		const copper = zinc.id === leftPlate.id ? rightPlate : leftPlate;
		const zincTerminal: LedTerminal = zinc.id === leftPlate.id ? 'left' : 'right';
		const copperTerminal: LedTerminal = zincTerminal === 'left' ? 'right' : 'left';
		const zincLemon = plateTouchById[zinc.id];
		const copperLemon = plateTouchById[copper.id];

		if (zincLemon && zincLemon === copperLemon) {
			nextCircuits.push({
				id: 'led-circuit',
				kind: 'led',
				lemonId: zincLemon,
				zincId: zinc.id,
				copperId: copper.id,
				points: [
					getPlateBase(zinc),
					getLedTerminal(led, zincTerminal),
					getLedTerminal(led, copperTerminal),
					getPlateBase(copper)
				]
			});
		}
	}

	return nextCircuits;
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
	const totalLength = getTotalLength(circuit.points);

	if (totalLength < 1) {
		return [] as ElectronDot[];
	}

	const speed = circuit.kind === 'led' ? 164 : 138;
	const count = circuit.kind === 'led' ? 8 : 6;

	return Array.from({ length: count }, (_, index) => {
		const travel = (animationTime * speed + (index * totalLength) / count) % totalLength;
		const point = pointAlongPolyline(circuit.points, travel);

		return {
			id: `${circuit.id}-${index}`,
			x: point.x,
			y: point.y,
			size: circuit.kind === 'led' ? 4.9 : 4.3
		};
	});
}
