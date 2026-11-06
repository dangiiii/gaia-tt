'use client';

import { useState } from 'react';
import { ExplorerWorkspace } from '@/components/ExplorerWorkspace';
import { TopicKey, DEFAULT_TOPIC } from '@/lib/topicConfig';
import '@xyflow/react/dist/style.css';

export default function Home() {
  const [currentTopic, setCurrentTopic] = useState<TopicKey>(DEFAULT_TOPIC.id);

  return (
    <div className="h-screen">
      <ExplorerWorkspace
        topic={currentTopic}
        onTopicChange={(value) => setCurrentTopic(value as TopicKey)}
      />
    </div>
  );
}