from pathlib import Path
import hashlib

ROOT = Path("C:\\Users\\pdard\\OneDrive\\Desktop\\voxel games\\gauntlet_l")
PROJECT = ROOT / "godot"
PREFIX = "res:" + "/" + "/"
TEMPLATES = [{"path":"project.godot","code":"config_version=5\n\n[application]\nconfig/name=\"Gauntlet Souls-FPS\"\nrun/main_scene=\"RES_PREFIXscenes/adventure.tscn\"\nconfig/features=PackedStringArray(\"4.7\", \"GL Compatibility\")\nrun/max_fps=60\n\n[autoload]\nGlobal=\"*RES_PREFIXscripts/global.gd\"\nAdventure=\"*RES_PREFIXscripts/adventure_state.gd\"\n\n[display]\nwindow/size/viewport_width=960\nwindow/size/viewport_height=540\nwindow/size/window_width_override=1280\nwindow/size/window_height_override=720\nwindow/size/resizable=true\nwindow/stretch/mode=\"canvas_items\"\nwindow/vsync/vsync_mode=1\n\n[rendering]\nrenderer/rendering_method=\"gl_compatibility\"\nrenderer/rendering_method.mobile=\"gl_compatibility\"\nscaling_3d/scale=0.75\nenvironment/defaults/default_clear_color=Color(0.05, 0.07, 0.1, 1)"},{"path":"scenes/adventure.tscn","code":"[gd_scene load_steps=2 format=3]\n\n[ext_resource type=\"Script\" path=\"RES_PREFIXscripts/adventure_main.gd\" id=\"1_adventure\"]\n\n[node name=\"Adventure\" type=\"Node3D\"]\nscript = ExtResource(\"1_adventure\")"}]

for item in TEMPLATES:
    target = (PROJECT / item["path"]).resolve()
    assert target.is_relative_to(PROJECT.resolve())
    content = item["code"].replace("RES_PREFIX", PREFIX).encode("utf-8")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    assert target.read_bytes() == content
    print(target.relative_to(ROOT), hashlib.sha256(content).hexdigest())
