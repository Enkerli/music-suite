cmake_minimum_required(VERSION 3.22)
project(Workspace VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED YES)

include("${CMAKE_CURRENT_SOURCE_DIR}/enkerli-juce/cmake/EnkerliPlugin.cmake")
enkerli_resolve_juce()

# Per-machine signing override (gitignored) — see signing.local.cmake.example.
include("${CMAKE_CURRENT_SOURCE_DIR}/signing.local.cmake" OPTIONAL)

# ── Plugin (aumi archetype — the suite's known-good MIDI-effect settings) ────
# Identity is forever: Wksp / com.enkerli.workspace (plugin-codes-are-forever).
enkerli_add_midi_effect_plugin(Workspace
    PRODUCT_NAME "Suite Workspace"
    PLUGIN_CODE  Wksp
    BUNDLE_ID    "com.enkerli.workspace"
    VERSION      "${PROJECT_VERSION}"
    DESCRIPTION  "Suite modules on one bus, in a DAW: GloriArp grooves out as MIDI, hardware MIDI in through the bindings"
)

target_sources(Workspace PRIVATE Source/Plugin.cpp)
if(APPLE)
    # Native save path for the WebView UI (share sheet on iPadOS; compiles
    # empty on macOS where FileChooser is used instead).
    target_sources(Workspace PRIVATE enkerli-juce/src/FileExport.mm)
endif()

# ── WebUI: built from the music-suite monorepo at configure/build time ───────
# The UI SOURCE lives in music-suite (apps/workspace) — single source shared
# with the browser webapp; only the C++ shell lives here (the Serpe pattern).
# Default to a sibling checkout; override per machine in webui.local.cmake.
# The monorepo must be `npm install`ed so esbuild + deps resolve from its
# hoisted node_modules.
set(WORKSPACE_WEBUI_DIR "${CMAKE_SOURCE_DIR}/../music-suite/apps/workspace"
    CACHE PATH "Path to the Workspace WebUI source (music-suite/apps/workspace)")
include("${CMAKE_CURRENT_SOURCE_DIR}/webui.local.cmake" OPTIONAL)
set(WEBUI_DIR   "${WORKSPACE_WEBUI_DIR}")
set(WEBUI_BUILD "${CMAKE_CURRENT_BINARY_DIR}/webui")

if(NOT EXISTS "${WEBUI_DIR}/main.js")
    message(FATAL_ERROR
        "Workspace WebUI source not found at ${WEBUI_DIR}. It lives in the "
        "music-suite monorepo (apps/workspace). Check out music-suite next to "
        "this repo, or set WORKSPACE_WEBUI_DIR in webui.local.cmake.")
endif()

find_program(NPXCMD npx)
if(NPXCMD)
    file(GLOB WEBUI_SRC
        "${WEBUI_DIR}/*.js" "${WEBUI_DIR}/*.css" "${WEBUI_DIR}/index.html")
    add_custom_command(
        OUTPUT  "${WEBUI_BUILD}/bundle.js"
        COMMAND "${CMAKE_COMMAND}" -E make_directory "${WEBUI_BUILD}"
        COMMAND "${NPXCMD}" esbuild "${WEBUI_DIR}/main.js"
                    --bundle --conditions=source
                    --loader:.css=text --loader:.svg=dataurl
                    "--define:process.env.NODE_ENV=\"production\"" --minify
                    "--outfile=${WEBUI_BUILD}/bundle.js"
        DEPENDS ${WEBUI_SRC}
        WORKING_DIRECTORY "${WEBUI_DIR}"
        COMMENT "Bundling Workspace WebUI with esbuild"
        VERBATIM)
    add_custom_target(WorkspaceWebUIBundle DEPENDS "${WEBUI_BUILD}/bundle.js")
else()
    message(WARNING "npx not found — Workspace WebUI bundle.js must be pre-built at ${WEBUI_BUILD}/bundle.js")
endif()

set_source_files_properties("${WEBUI_BUILD}/bundle.js" PROPERTIES GENERATED TRUE)
juce_add_binary_data(WorkspaceWebUI
    HEADER_NAME BinaryDataWebUI.h
    NAMESPACE   BinaryData
    SOURCES
        "${WEBUI_DIR}/index.html"
        "${WEBUI_BUILD}/bundle.js")
if(NPXCMD)
    add_dependencies(WorkspaceWebUI WorkspaceWebUIBundle)
endif()

target_link_libraries(Workspace PRIVATE
    WorkspaceWebUI
    juce::juce_audio_utils
    juce::juce_gui_extra
    PUBLIC
    juce::juce_recommended_config_flags
    juce::juce_recommended_warning_flags)
