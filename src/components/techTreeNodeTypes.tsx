'use client';

import React from 'react';
import { NodeProps, NodeTypes } from '@xyflow/react';
import { CompanyNodeData, LiteratureNodeData, UiNode } from '@/lib/types';
import { CustomNode } from './CustomNode';
import { CompanyNode } from './CompanyNode';
import { LiteratureNode } from './LiteratureNode';
import { MoreCompaniesNode, MoreCompaniesNodeData } from './MoreCompaniesNode';
import { AggregateNode } from './AggregateNode';
import { GroupFrameNode } from './GroupFrameNode';
import { useTechTreeNodeActions } from './techTreeNodeActions';

const noop = () => {};

function TechnologyNode(props: NodeProps) {
  const actions = useTechTreeNodeActions();
  const data = props.data as UiNode['data'];
  if (!actions) {
    return (
      <CustomNode
        {...props}
        data={data}
        onShowDetails={noop}
        onShowConnected={noop}
      />
    );
  }
  const literature = actions.literatureFor(props.id);
  return (
    <CustomNode
      {...props}
      data={data}
      onShowDetails={actions.onShowDetails}
      onShowConnected={actions.onShowConnected}
      onShowCompanies={actions.onShowCompanies}
      isCompaniesExpanded={actions.isCompaniesExpanded}
      onShowLiterature={literature ? actions.onShowLiterature : undefined}
      isLiteratureExpanded={actions.isLiteratureExpanded}
      literatureCount={literature?.papers}
      onToggleFold={actions.onToggleFold}
    />
  );
}

function TechTreeLiteratureNode(props: NodeProps) {
  const actions = useTechTreeNodeActions();
  const data = props.data as unknown as LiteratureNodeData;
  return (
    <LiteratureNode
      {...props}
      data={data}
      onShowPaper={actions?.onShowPaper ?? noop}
      votes={actions?.votesFor(data.entity.id)}
      onVote={
        actions ? (vote) => actions.onLitVote(data.entity.id, vote) : undefined
      }
    />
  );
}

function TechTreeCompanyNode(props: NodeProps) {
  const actions = useTechTreeNodeActions();
  return (
    <CompanyNode
      {...props}
      data={props.data as unknown as CompanyNodeData}
      onShowCompanyDetails={actions?.onShowCompanyDetails ?? noop}
    />
  );
}

function TechTreeMoreCompaniesNode(props: NodeProps) {
  const actions = useTechTreeNodeActions();
  return (
    <MoreCompaniesNode
      {...props}
      data={props.data as unknown as MoreCompaniesNodeData}
      onShowParentCompanies={actions?.onShowMoreCompanies ?? noop}
    />
  );
}

/** Stable across renders; behaviour comes from `TechTreeNodeActionsContext`. */
export const TECH_TREE_NODE_TYPES: NodeTypes = {
  default: TechnologyNode,
  literature: TechTreeLiteratureNode,
  company: TechTreeCompanyNode,
  moreCompanies: TechTreeMoreCompaniesNode,
  aggregate: AggregateNode,
  groupFrame: GroupFrameNode,
};
