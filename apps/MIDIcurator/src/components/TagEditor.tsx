interface TagEditorProps {
  tags: string[];
  newTag: string;
  onNewTagChange: (value: string) => void;
  onAddTag: () => void;
  /** When provided, clicking a tag filters the clip list by that tag. */
  onTagClick?: (tag: string) => void;
}

export function TagEditor({ tags, newTag, onNewTagChange, onAddTag, onTagClick }: TagEditorProps) {
  return (
    <div className="mc-tags-section">
      <h3>Tags</h3>
      <div className="mc-tags-list">
        {tags.map(tag => (
          <span
            key={tag}
            className={`mc-tag ${onTagClick ? 'mc-tag--clickable' : ''}`}
            onClick={onTagClick ? () => onTagClick(tag) : undefined}
            title={onTagClick ? `Filter by "${tag}"` : undefined}
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="mc-tag-input-row">
        <input
          type="text"
          className="mc-tag-input"
          placeholder="Add tag..."
          value={newTag}
          onChange={(e) => onNewTagChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAddTag()}
        />
        <button className="mc-btn--add-tag" onClick={onAddTag}>
          Add
        </button>
      </div>
    </div>
  );
}
