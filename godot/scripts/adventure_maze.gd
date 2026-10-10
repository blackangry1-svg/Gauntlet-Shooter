class_name AdventureMaze
extends RefCounted

static func cell_key(cell: Vector2i) -> String:
	return str(cell.x) + ":" + str(cell.y)

static func is_open(grid: Array, cell: Vector2i, blocked: Dictionary = {}) -> bool:
	if cell.y < 0 or cell.y >= grid.size():
		return false
	var row: String = str(grid[cell.y])
	if cell.x < 0 or cell.x >= row.length():
		return false
	return row.substr(cell.x, 1) != "#" and not blocked.has(cell_key(cell))

static func neighbors(grid: Array, cell: Vector2i, blocked: Dictionary = {}) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	for delta in [Vector2i.RIGHT, Vector2i.DOWN, Vector2i.LEFT, Vector2i.UP]:
		var candidate: Vector2i = cell + delta
		if is_open(grid, candidate, blocked):
			result.append(candidate)
	return result

static func reachable(grid: Array, start: Vector2i, blocked: Dictionary = {}) -> Dictionary:
	var visited: Dictionary = {}
	if not is_open(grid, start, blocked):
		return visited
	var queue: Array[Vector2i] = [start]
	visited[cell_key(start)] = true
	var cursor: int = 0
	while cursor < queue.size():
		var current: Vector2i = queue[cursor]
		cursor += 1
		for candidate in neighbors(grid, current, blocked):
			var key: String = cell_key(candidate)
			if not visited.has(key):
				visited[key] = true
				queue.append(candidate)
	return visited

static func path(grid: Array, start: Vector2i, goal: Vector2i, blocked: Dictionary = {}) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	if not is_open(grid, start, blocked) or not is_open(grid, goal, blocked):
		return result
	var queue: Array[Vector2i] = [start]
	var previous: Dictionary = {cell_key(start): start}
	var cursor: int = 0
	while cursor < queue.size():
		var current: Vector2i = queue[cursor]
		cursor += 1
		if current == goal:
			var step: Vector2i = goal
			result.append(step)
			while step != start:
				step = previous[cell_key(step)]
				result.append(step)
			result.reverse()
			return result
		for candidate in neighbors(grid, current, blocked):
			var key: String = cell_key(candidate)
			if not previous.has(key):
				previous[key] = current
				queue.append(candidate)
	return result

static func merged_runs(grid: Array, walls: bool, omitted: Dictionary = {}) -> Array[Dictionary]:
	var rectangles: Array[Dictionary] = []
	var last_by_span: Dictionary = {}
	for z in range(grid.size()):
		var row: String = str(grid[z])
		var x: int = 0
		while x < row.length():
			var cell: Vector2i = Vector2i(x, z)
			var wanted: bool = (row.substr(x, 1) == "#") == walls and not omitted.has(cell_key(cell))
			if not wanted:
				x += 1
				continue
			var start: int = x
			while x < row.length():
				var next_cell: Vector2i = Vector2i(x, z)
				if (row.substr(x, 1) == "#") != walls or omitted.has(cell_key(next_cell)):
					break
				x += 1
			var width: int = x - start
			var span: String = str(start) + ":" + str(width)
			var merged: bool = false
			if last_by_span.has(span):
				var index: int = int(last_by_span[span])
				var rect: Dictionary = rectangles[index]
				var origin: Vector2i = rect["cell"]
				var extent: Vector2i = rect["size"]
				if origin.y + extent.y == z:
					rect["size"] = Vector2i(extent.x, extent.y + 1)
					rectangles[index] = rect
					merged = true
			if not merged:
				last_by_span[span] = rectangles.size()
				rectangles.append({"cell": Vector2i(start, z), "size": Vector2i(width, 1)})
	return rectangles

static func point(raw: Variant) -> Vector2i:
	if raw is Vector2i:
		return raw
	if raw is Array and raw.size() >= 2:
		return Vector2i(int(raw[0]), int(raw[1]))
	return Vector2i.ZERO

static func choose_branch(grid: Array, start: Vector2i, blocked: Dictionary, reserved: Dictionary, ordinal: int = 0) -> Vector2i:
	var visited: Dictionary = reachable(grid, start, blocked)
	var candidates: Array[Vector2i] = []
	for z in range(grid.size()):
		for x in range(str(grid[z]).length()):
			var cell: Vector2i = Vector2i(x, z)
			var key: String = cell_key(cell)
			if visited.has(key) and not reserved.has(key) and neighbors(grid, cell, blocked).size() == 1:
				candidates.append(cell)
	candidates.sort_custom(func(a: Vector2i, b: Vector2i) -> bool:
		var da: int = absi(a.x - start.x) + absi(a.y - start.y)
		var db: int = absi(b.x - start.x) + absi(b.y - start.y)
		return da > db if da != db else (a.y * 100 + a.x) < (b.y * 100 + b.x))
	if not candidates.is_empty():
		return candidates[posmod(ordinal, candidates.size())]
	for z in range(grid.size()):
		for x in range(str(grid[z]).length()):
			var cell: Vector2i = Vector2i(x, z)
			if visited.has(cell_key(cell)) and not reserved.has(cell_key(cell)):
				return cell
	return start
