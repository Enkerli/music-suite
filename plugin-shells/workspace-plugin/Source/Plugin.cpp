#include "PluginProcessor.h"
#include "PluginEditor.h"

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new WorkspaceProcessor();
}
