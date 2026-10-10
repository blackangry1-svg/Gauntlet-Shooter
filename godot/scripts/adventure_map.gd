extends Control

var map_data: Dictionary = {}
var seen: Dictionary = {}
var player_cell := Vector2i.ZERO
var heading: float = 0.0

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.035, 0.045, 0.065, 0.94))
	var grid: Array = map_data.get("grid", [])
	if grid.is_empty():
		return
	var step: float = minf(size.x, size.y) / float(grid.size())
	for y in range(grid.size()):
		var row: String = str(grid[y])
		for x in range(row.length()):
			if not seen.has(Vector2i(x, y)):
				continue
			var color := Color(0.13, 0.17, 0.21) if row[x] == "#" else Color(0.39, 0.46, 0.48)
			draw_rect(Rect2(Vector2(x, y) * step, Vector2.ONE * step), color)
	for marker in map_data.get("markers", []):
		var cell = marker.get("cell", Vector2i.ZERO)
		if cell is Array:
			cell = Vector2i(int(cell[0]), int(cell[1]))
		if not cell is Vector2i or not seen.has(cell):
			continue
		var kind: String = str(marker.get("type", ""))
		var color := Color(0.95, 0.7, 0.28)
		if "gate" in kind or "boss" in kind:
			color = Color(0.9, 0.3, 0.3)
		elif "lift" in kind or "checkpoint" in kind:
			color = Color(0.3, 0.85, 0.9)
		draw_circle((Vector2(cell) + Vector2.ONE * 0.5) * step, maxf(1.5, step * 0.32), color)
	var center := (Vector2(player_cell) + Vector2.ONE * 0.5) * step
	draw_circle(center, maxf(2.0, step * 0.33), Color.WHITE)
	draw_line(center, center + Vector2(-sin(heading), -cos(heading)) * step * 1.2, Color.WHITE, 2)
