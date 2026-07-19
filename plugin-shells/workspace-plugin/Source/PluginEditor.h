#pragma once
#include "PluginProcessor.h"
#include "../enkerli-juce/src/EnkerliWebView.h"
#include "../enkerli-juce/src/FileExport.h"
#include "../enkerli-juce/src/RuntimeInfo.h"
#include "BinaryDataWebUI.h"

// The bridge contract lives in music-suite docs/WORKSPACE_PLUGIN.md §3 and
// apps/workspace/juce-bridge.js — keep the three in sync.
class WorkspaceEditor : public juce::AudioProcessorEditor,
                        private juce::Timer
{
public:
    explicit WorkspaceEditor (WorkspaceProcessor& p)
        : juce::AudioProcessorEditor (p),
          proc (p),
          web (
              {
                  { "/index.html", { BinaryData::index_html, BinaryData::index_htmlSize, "text/html; charset=utf-8" } },
                  { "/bundle.js",  { BinaryData::bundle_js,  BinaryData::bundle_jsSize,  "application/javascript" } },
              },
              {
                  { "uiReady", [this] (const juce::var&) { pageReady = true; sendSavedState(); } },
                  { "log", [] (const juce::var& v)
                      { std::fprintf (stderr, "[workspace-js:%s] %s\n",
                            v.getProperty ("level", "log").toString().toRawUTF8(),
                            v.getProperty ("msg", "").toString().toRawUTF8()); } },
                  // The bus's note edge: a `note` message crossing to host MIDI.
                  { "noteOut", [this] (const juce::var& v) { playNotes (v); } },
                  { "allOff", [this] (const juce::var&) { proc.scheduler.allOff(); } },
                  // Workspace layout/state → DAW session (page also keeps localStorage).
                  { "enkerliState", [this] (const juce::var& v)
                      { proc.storeUiState (v.getProperty ("json", "").toString()); } },
                  // WKWebView can't download (TESTING.md) — native save path.
                  { "enkerliSaveFile", [this] (const juce::var& v) { saveFile (v); } },
              })
    {
        addAndMakeVisible (web);
        web.start();
        setSize (1100, 760);
        setResizable (true, true);
        startTimerHz (10);
    }

    void resized() override { web.setBounds (getLocalBounds()); }

private:
    void sendSavedState()
    {
        const auto json = proc.loadUiState();
        if (json.isEmpty())
            return;
        auto* obj = new juce::DynamicObject();
        obj->setProperty ("json", json);
        web.emit ("state", juce::var (obj));
    }

    void playNotes (const juce::var& v)
    {
        const int velocity = juce::jlimit (1, 127, static_cast<int> (v.getProperty ("velocity", 96)));
        const int channel = juce::jlimit (1, 16, static_cast<int> (v.getProperty ("channel", 1)));
        const double durationMs = juce::jmax (1.0, static_cast<double> (v.getProperty ("durationMs", 250.0)));
        if (auto* arr = v.getProperty ("notes", juce::var()).getArray())
            for (const auto& n : *arr)
                proc.scheduler.noteOn (static_cast<int> (n), velocity, channel, durationMs);
    }

    void saveFile (const juce::var& v)
    {
        const auto name = v.getProperty ("name", "export.bin").toString()
                              .replaceCharacters ("/\\:", "---");
        juce::MemoryOutputStream decoded;
        if (! juce::Base64::convertFromBase64 (decoded, v.getProperty ("b64", "").toString()))
            return;
        enkerli::exportBytes (*this, name, decoded.getMemoryBlock());
    }

    void timerCallback() override
    {
        if (! pageReady)
            return;

        auto* obj = new juce::DynamicObject();
        obj->setProperty ("bpm", proc.transport.getBpm());
        obj->setProperty ("playing", proc.transport.isPlaying());
        web.emit ("transport", juce::var (obj));

        // Host MIDI in → the page's bindings module, one event per emit
        // (typical binding traffic is sparse; the collector caps bursts).
        proc.midiIn.drain (drained);
        for (const auto& e : drained)
        {
            auto* m = new juce::DynamicObject();
            if (e.isCc)
            {
                m->setProperty ("kind", "cc");
                m->setProperty ("cc", e.note);
                m->setProperty ("value", e.value);
            }
            else
            {
                m->setProperty ("kind", "note");
                m->setProperty ("note", e.note);
                m->setProperty ("velocity", e.value);
            }
            m->setProperty ("channel", e.channel);
            web.emit ("midiIn", juce::var (m));
        }

        if (++runtimeTick % 20 == 0) // every ~2 s at 10 Hz
            web.emit ("runtime", enkerli::RuntimeInfo::snapshot (proc));
    }

    WorkspaceProcessor& proc;
    enkerli::BridgedWebView web;
    std::vector<workspace::MidiInEvent> drained;
    bool pageReady = false;
    int runtimeTick = 0;
};

inline juce::AudioProcessorEditor* WorkspaceProcessor::createEditor()
{
    return new WorkspaceEditor (*this);
}
