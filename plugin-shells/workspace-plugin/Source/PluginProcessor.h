#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include "../enkerli-juce/src/TransportSnapshot.h"
#include "LiveNoteScheduler.h"
#include "MidiInCollector.h"

// Suite Workspace plugin — the movable-module control-plane webapp
// (music-suite apps/workspace) as an aumi MIDI processor
// (docs/WORKSPACE_PLUGIN.md). The WebView UI is the SAME bundle the
// browser runs; this side swaps the bus's edges: bus `note` messages exit
// as real host MIDI (LiveNoteScheduler), host MIDI in feeds the bindings
// module (MidiInCollector), and the workspace layout rides the DAW session.
//
// Incoming MIDI PASSES THROUGH (a hub sitting mid-chain must not eat the
// keyboard); the scheduler's notes are appended after collection.
class WorkspaceProcessor : public juce::AudioProcessor
{
public:
    WorkspaceProcessor()
        : juce::AudioProcessor (BusesProperties()) // MIDI effect: no audio buses
    {
    }

    void prepareToPlay (double newSampleRate, int) override { sampleRate = newSampleRate; }
    void releaseResources() override {}

    void processBlock (juce::AudioBuffer<float>& audio, juce::MidiBuffer& midi) override
    {
        audio.clear();
        if (audio.getNumSamples() > 0)
            lastBlockSize = audio.getNumSamples();
        transport.capture (getPlayHead());
        midiIn.collect (midi);
        scheduler.process (midi, sampleRate, lastBlockSize);
    }

    void processBlock (juce::AudioBuffer<double>& audio, juce::MidiBuffer& midi) override
    {
        if (audio.getNumSamples() > 0)
            lastBlockSize = audio.getNumSamples();
        transport.capture (getPlayHead());
        midiIn.collect (midi);
        scheduler.process (midi, sampleRate, lastBlockSize);
    }

    bool isMidiEffect() const override { return true; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return true; }

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "Suite Workspace"; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    // Session state = the workspace layout + module state JSON the page
    // mirrors over the bridge (the same JSON it keeps in localStorage; the
    // DAW session wins on restore — docs/WORKSPACE_PLUGIN.md §4).
    void getStateInformation (juce::MemoryBlock& dest) override
    {
        const juce::ScopedLock sl (stateLock);
        dest.replaceAll (stateJson.toRawUTF8(), stateJson.getNumBytesAsUTF8());
    }

    void setStateInformation (const void* data, int size) override
    {
        const juce::ScopedLock sl (stateLock);
        stateJson = juce::String::fromUTF8 (static_cast<const char*> (data), size);
    }

    void storeUiState (const juce::String& json)
    {
        const juce::ScopedLock sl (stateLock);
        stateJson = json;
    }

    juce::String loadUiState() const
    {
        const juce::ScopedLock sl (stateLock);
        return stateJson;
    }

    workspace::LiveNoteScheduler scheduler;
    workspace::MidiInCollector midiIn;
    enkerli::TransportSnapshot transport;

private:
    double sampleRate = 44100.0;
    int lastBlockSize = 512;
    juce::String stateJson;
    juce::CriticalSection stateLock;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (WorkspaceProcessor)
};
