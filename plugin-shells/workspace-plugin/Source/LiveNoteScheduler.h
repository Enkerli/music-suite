#pragma once

// LiveNoteScheduler — immediate ("play NOW") note scheduling for the
// Workspace plugin's bus→MIDI edge (music-suite docs/WORKSPACE_PLUGIN.md §3).
//
// Deliberately NOT MidiClipScheduler: that is host-beat-synced clip playback,
// and the Workspace's groove player is its own clock by design (live loops,
// per-pass regeneration — the page decides WHEN, this side only turns a bus
// `note` message into host MIDI with a tracked note-off).
//
// Same audio-thread discipline as the rest of the foundation: the message
// thread pushes into a lock-free SPSC ring; processBlock drains it, emits
// note-ons at offset 0, and tracks each note's remaining samples so the
// note-off lands on time. allOff (stop/panic) sends explicit offs for every
// tracked note plus CC123 on every channel it touched — the msuite midiout
// contract, applied here.

#include <array>
#include <atomic>
#include <juce_audio_basics/juce_audio_basics.h>

namespace workspace
{

struct PendingNote
{
    int note;            // 0–127
    int velocity;        // 1–127
    int channel;         // 1–16
    double durationMs;
};

class LiveNoteScheduler
{
public:
    /** Message thread: queue one note (from a bus `note` message). */
    void noteOn (int note, int velocity, int channel, double durationMs) noexcept
    {
        const int w = writePos.load (std::memory_order_relaxed);
        const int next = (w + 1) % capacity;
        if (next == readPos.load (std::memory_order_acquire))
            return; // full — drop the note-on whole (never a stuck note)
        ring[(size_t) w] = { juce::jlimit (0, 127, note),
                             juce::jlimit (1, 127, velocity),
                             juce::jlimit (1, 16, channel),
                             juce::jmax (1.0, durationMs) };
        writePos.store (next, std::memory_order_release);
    }

    /** Message thread: stop everything sounding (explicit offs + CC123). */
    void allOff() noexcept { panic.store (true, std::memory_order_release); }

    /** Audio thread: drain pending ons, emit due offs, honor panic. */
    void process (juce::MidiBuffer& midi, double sampleRate, int numSamples) noexcept
    {
        if (panic.exchange (false, std::memory_order_acq_rel))
        {
            for (auto& a : active)
                if (a.samplesLeft > 0)
                {
                    midi.addEvent (juce::MidiMessage::noteOff (a.channel, a.note, (juce::uint8) 0), 0);
                    a.samplesLeft = 0;
                }
            for (int ch = 1; ch <= 16; ++ch)
                if (channelsTouched[(size_t) (ch - 1)])
                {
                    midi.addEvent (juce::MidiMessage::allNotesOff (ch), 0);
                    channelsTouched[(size_t) (ch - 1)] = false;
                }
        }

        // New note-ons land at the top of this block.
        int r = readPos.load (std::memory_order_relaxed);
        const int w = writePos.load (std::memory_order_acquire);
        while (r != w)
        {
            const auto& p = ring[(size_t) r];
            midi.addEvent (juce::MidiMessage::noteOn (p.channel, p.note, (juce::uint8) p.velocity), 0);
            channelsTouched[(size_t) (p.channel - 1)] = true;
            // Track for the off; if the table is full, off immediately next
            // block rather than sticking (slot 0 samples → off below).
            int slot = -1;
            for (int i = 0; i < maxActive; ++i)
                if (active[(size_t) i].samplesLeft <= 0) { slot = i; break; }
            const int samples = (int) juce::jmax (1.0, p.durationMs * sampleRate / 1000.0);
            if (slot >= 0)
                active[(size_t) slot] = { p.note, p.channel, samples };
            else
                midi.addEvent (juce::MidiMessage::noteOff (p.channel, p.note, (juce::uint8) 0),
                               juce::jmin (numSamples - 1, 1));
            r = (r + 1) % capacity;
        }
        readPos.store (r, std::memory_order_release);

        // Due note-offs, sample-placed within this block.
        for (auto& a : active)
        {
            if (a.samplesLeft <= 0)
                continue;
            if (a.samplesLeft <= numSamples)
            {
                midi.addEvent (juce::MidiMessage::noteOff (a.channel, a.note, (juce::uint8) 0),
                               juce::jmax (0, a.samplesLeft - 1));
                a.samplesLeft = 0;
            }
            else
            {
                a.samplesLeft -= numSamples;
            }
        }
    }

private:
    static constexpr int capacity = 256;   // pending ons per block-interval
    static constexpr int maxActive = 128;  // simultaneous tracked notes

    struct ActiveNote
    {
        int note = 0;
        int channel = 1;
        int samplesLeft = 0;
    };

    std::array<PendingNote, (size_t) capacity> ring {};
    std::atomic<int> writePos { 0 };
    std::atomic<int> readPos { 0 };
    std::atomic<bool> panic { false };
    std::array<ActiveNote, (size_t) maxActive> active {};
    std::array<bool, 16> channelsTouched {};
};

} // namespace workspace
