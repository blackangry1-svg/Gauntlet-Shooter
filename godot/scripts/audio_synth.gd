class_name AudioSynth
extends Node

var heartbeat_wav: AudioStreamWAV
var breathing_wav: AudioStreamWAV
var swing_wav: AudioStreamWAV
var impact_wav: AudioStreamWAV
var block_wav: AudioStreamWAV
var spell_wav: AudioStreamWAV
var roar_wav: AudioStreamWAV

func _ready() -> void:
	_generate_all_buffers()

func _generate_all_buffers() -> void:
	heartbeat_wav = _build_heartbeat_wav()
	breathing_wav = _build_breathing_wav()
	swing_wav = _build_swing_wav()
	impact_wav = _build_impact_wav()
	block_wav = _build_block_wav()
	spell_wav = _build_spell_wav()
	roar_wav = _build_roar_wav()

func _create_wav(data: PackedByteArray, sample_rate: int = 22050) -> AudioStreamWAV:
	var stream = AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = sample_rate
	stream.stereo = false
	stream.data = data
	return stream

func _build_heartbeat_wav() -> AudioStreamWAV:
	var sample_rate = 22050
	var duration = 0.55
	var total_samples = int(sample_rate * duration)
	var byte_array = PackedByteArray()
	byte_array.resize(total_samples * 2)
	
	for i in range(total_samples):
		var t = float(i) / float(sample_rate)
		var sample = 0.0
		# Lub (0.0 to 0.18s)
		if t < 0.18:
			var env = sin(t / 0.18 * PI)
			sample += sin(2.0 * PI * 58.0 * t) * env * 0.95
			sample += sin(2.0 * PI * 116.0 * t) * env * 0.4
		# Dub (0.24 to 0.42s)
		elif t >= 0.24 and t < 0.42:
			var dt = t - 0.24
			var env = sin(dt / 0.18 * PI)
			sample += sin(2.0 * PI * 65.0 * dt) * env * 0.85
			sample += sin(2.0 * PI * 130.0 * dt) * env * 0.35
		
		var sample_16 = int(clamp(sample, -1.0, 1.0) * 32767.0)
		byte_array.encode_s16(i * 2, sample_16)
		
	return _create_wav(byte_array, sample_rate)

func _build_breathing_wav() -> AudioStreamWAV:
	var sample_rate = 22050
	var duration = 1.2
	var total_samples = int(sample_rate * duration)
	var byte_array = PackedByteArray()
	byte_array.resize(total_samples * 2)
	
	for i in range(total_samples):
		var t = float(i) / float(sample_rate)
		# Low filtered noise simulation
		var raw_noise = (randf() * 2.0 - 1.0)
		var env = sin(t / duration * PI)
		var raspy = raw_noise * 0.5 + sin(2.0 * PI * 110.0 * t) * 0.5
		var sample = raspy * env * 0.65
		var sample_16 = int(clamp(sample, -1.0, 1.0) * 32767.0)
		byte_array.encode_s16(i * 2, sample_16)
		
	return _create_wav(byte_array, sample_rate)

func _build_swing_wav() -> AudioStreamWAV:
	var sample_rate = 22050
	var duration = 0.25
	var total_samples = int(sample_rate * duration)
	var byte_array = PackedByteArray()
	byte_array.resize(total_samples * 2)
	
	for i in range(total_samples):
		var t = float(i) / float(sample_rate)
		var freq = lerp(450.0, 120.0, t / duration)
		var env = sin(t / duration * PI)
		var sample = (sin(2.0 * PI * freq * t) + (randf() * 2.0 - 1.0) * 0.3) * env * 0.7
		var sample_16 = int(clamp(sample, -1.0, 1.0) * 32767.0)
		byte_array.encode_s16(i * 2, sample_16)
		
	return _create_wav(byte_array, sample_rate)

func _build_impact_wav() -> AudioStreamWAV:
	var sample_rate = 22050
	var duration = 0.30
	var total_samples = int(sample_rate * duration)
	var byte_array = PackedByteArray()
	byte_array.resize(total_samples * 2)
	
	for i in range(total_samples):
		var t = float(i) / float(sample_rate)
		var env = exp(-t * 14.0)
		var sample = (sin(2.0 * PI * 90.0 * t) * 0.6 + (randf() * 2.0 - 1.0) * 0.4) * env
		var sample_16 = int(clamp(sample, -1.0, 1.0) * 32767.0)
		byte_array.encode_s16(i * 2, sample_16)
		
	return _create_wav(byte_array, sample_rate)

func _build_block_wav() -> AudioStreamWAV:
	var sample_rate = 22050
	var duration = 0.40
	var total_samples = int(sample_rate * duration)
	var byte_array = PackedByteArray()
	byte_array.resize(total_samples * 2)
	
	for i in range(total_samples):
		var t = float(i) / float(sample_rate)
		var env = exp(-t * 9.0)
		var sample = (sin(2.0 * PI * 880.0 * t) * 0.4 + sin(2.0 * PI * 1320.0 * t) * 0.3 + (randf() * 2.0 - 1.0) * 0.3) * env
		var sample_16 = int(clamp(sample, -1.0, 1.0) * 32767.0)
		byte_array.encode_s16(i * 2, sample_16)
		
	return _create_wav(byte_array, sample_rate)

func _build_spell_wav() -> AudioStreamWAV:
	var sample_rate = 22050
	var duration = 0.50
	var total_samples = int(sample_rate * duration)
	var byte_array = PackedByteArray()
	byte_array.resize(total_samples * 2)
	
	for i in range(total_samples):
		var t = float(i) / float(sample_rate)
		var freq = lerp(200.0, 800.0, t / duration)
		var env = sin(t / duration * PI)
		var sample = (sin(2.0 * PI * freq * t) * 0.5 + sin(2.0 * PI * (freq * 1.5) * t) * 0.3 + (randf() * 2.0 - 1.0) * 0.2) * env
		var sample_16 = int(clamp(sample, -1.0, 1.0) * 32767.0)
		byte_array.encode_s16(i * 2, sample_16)
		
	return _create_wav(byte_array, sample_rate)

func _build_roar_wav() -> AudioStreamWAV:
	var sample_rate = 22050
	var duration = 1.4
	var total_samples = int(sample_rate * duration)
	var byte_array = PackedByteArray()
	byte_array.resize(total_samples * 2)
	
	for i in range(total_samples):
		var t = float(i) / float(sample_rate)
		var env = sin(t / duration * PI)
		var freq = 75.0 + sin(t * 12.0) * 20.0
		var sample = (sin(2.0 * PI * freq * t) * 0.6 + (randf() * 2.0 - 1.0) * 0.4) * env
		var sample_16 = int(clamp(sample, -1.0, 1.0) * 32767.0)
		byte_array.encode_s16(i * 2, sample_16)
		
	return _create_wav(byte_array, sample_rate)

func play_sfx_3d(stream: AudioStream, pos: Vector3, volume_db: float = 0.0) -> AudioStreamPlayer3D:
	var player = AudioStreamPlayer3D.new()
	player.stream = stream
	player.position = pos
	player.volume_db = volume_db
	player.max_distance = 45.0
	player.attenuation_model = AudioStreamPlayer3D.ATTENUATION_INVERSE_DISTANCE
	add_child(player)
	player.play()
	player.finished.connect(func(): player.queue_free())
	return player

func play_sfx_2d(stream: AudioStream, volume_db: float = 0.0) -> AudioStreamPlayer:
	var player = AudioStreamPlayer.new()
	player.stream = stream
	player.volume_db = volume_db
	add_child(player)
	player.play()
	player.finished.connect(func(): player.queue_free())
	return player

