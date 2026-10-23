import WelcomeItem from '../WelcomeItem/WelcomeItem.vue'

import DocumentationIcon from '../icons/IconDocumentation/IconDocumentation.vue'

import ToolingIcon from '../icons/IconTooling/IconTooling.vue'

import EcosystemIcon from '../icons/IconEcosystem/IconEcosystem.vue'

import CommunityIcon from '../icons/IconCommunity/IconCommunity.vue'

import SupportIcon from '../icons/IconSupport/IconSupport.vue'

export function useTheWelcome<TProps extends Record<string, any> = Record<string, any>, TEmit = (...args: any[]) => any>() {
  const openReadmeInEditor = () => fetch('/__open-in-editor?file=README.md')

  return {
    WelcomeItem,
    DocumentationIcon,
    ToolingIcon,
    EcosystemIcon,
    CommunityIcon,
    SupportIcon,
    openReadmeInEditor,
  };
}
