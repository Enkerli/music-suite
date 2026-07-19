#pragma once

// MidiInCollector — host MIDI in → the page's bindings module
// (music-suite docs/WORKSPACE_PLUGIN.md §3). The enkerli-juce foundation's
// MidiInputCollector carries note on/off only; the Workspace's control-map
// layer (@enkerli/control) also binds CC knobs, so this local variant
// carries both. Same SPSC ring discipline (audio thread pushes, editor
// timer drains); upstreaming to the foundation is a noted follow-on, kept
// out of this repo's blast radius for now.

#include <array>
#include <atomic>
#include <vector>
#include <juce_audio_basics/juce_audio_basics.h>

namespace workspace
{

struct MidiInEvent
{
    bool isCc;       // true: cc/value; false: note/velocity
    int  note;       // note number, or CC number when isCc
    int  value;      // velocity (0 = off), or CC value
    int  channel;    // 1–16
};

class MidiInCollector
{
public:
    /** Audio thread: scan a block's incoming MIDI. */
    void collect (const juce::MidiBuffer& midi) noexcept
    {
        for (const auto meta : midi)
        {
            const auto m = meta.getMessage();
            if (m.isNoteOn())
                push ({ false, m.getNoteNumber(), m.getVelocity(), m.getChannel() });
            else if (m.isNoteOff())
                push ({ false, m.getNoteNumber(), 0, m.getChannel() });
            else if (m.isController())
                push ({ true, m.getControllerNumber(), m.getControllerValue(), m.getChannel() });
        }
    }

    /** Message thread: move all pending events into `out` (cleared first). */
    void drain (std::vector<MidiInEvent>& out) noexcept
    {
        out.clear();
        int r = readPos.load (std::memory_order_relaxed);
        const int w = writePos.load (std::memory_order_acquire);
        while (r != w)
        {
            out.push_back (ring[(size_t) r]);
            r = (r + 1) % capacity;
        }
        readPos.store (r, std::memory_order_release);
    }

private:
    static constexpr int capacity = 512;

    void push (MidiInEvent e) noexcept
    {
        const int w = writePos.load (std::memory_order_relaxed);
        const int next = (w + 1) % capacity;
        if (next == readPos.load (std::memory_order_acquire))
            return; // full — drop oldest-first pressure; bindings are edge-driven
        ring[(size_t) w] = e;
        writePos.store (next, std::memory_order_release);
    }

    std::array<MidiInEvent, (size_t) capacity> ring {};
    std::atomic<int> writePos { 0 };
    std::atomic<int> readPos { 0 };
};

} // namespace workspace
