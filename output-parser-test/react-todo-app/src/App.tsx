import { useState, useEffect, useRef } from 'react';
import './App.css';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

type FilterType = 'all' | 'active' | 'completed';

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Load todos from localStorage on mount
  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) {
      try {
        const parsedTodos = JSON.parse(savedTodos).map((todo: any) => ({
          ...todo,
          createdAt: new Date(todo.createdAt)
        }));
        setTodos(parsedTodos);
      } catch (e) {
        console.error('Failed to parse todos from localStorage', e);
        localStorage.removeItem('todos');
      }
    }
  }, []);

  // Save todos to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  // Focus input when editing
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const addTodo = () => {
    if (newTodo.trim() === '') {
      setError('Todo cannot be empty');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (newTodo.trim().length > 100) {
      setError('Todo cannot be longer than 100 characters');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const newTodoItem: Todo = {
      id: Date.now().toString(),
      text: newTodo.trim(),
      completed: false,
      createdAt: new Date(),
    };

    setTodos([newTodoItem, ...todos]);
    setNewTodo('');
    setSuccess('Todo added successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: string) => {
    const todoElement = document.getElementById(`todo-${id}`);
    if (todoElement) {
      todoElement.classList.add('removing');
      setTimeout(() => {
        setTodos(todos.filter(todo => todo.id !== id));
        setSuccess('Todo deleted successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }, 300);
    }
  };

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
  };

  const saveEdit = () => {
    if (editText.trim() === '') {
      setError('Todo cannot be empty');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (editText.trim().length > 100) {
      setError('Todo cannot be longer than 100 characters');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setTodos(todos.map(todo => 
      todo.id === editingId ? { ...todo, text: editText.trim() } : todo
    ));
    setEditingId(null);
    setSuccess('Todo updated successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const activeCount = todos.filter(todo => !todo.completed).length;
  const completedCount = todos.length - activeCount;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editingId) {
        saveEdit();
      } else {
        addTodo();
      }
    }
  };

  return (
    <div className="App">
      <div className="header">
        <h1>✨ Todo List</h1>
        <p>Organize your tasks with style and functionality</p>
      </div>

      {/* Stats Card */}
      <div className="stats-card">
        <div className="stat-item">
          <div className="stat-label">Total</div>
          <div className="stat-value">{todos.length}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Active</div>
          <div className="stat-value">{activeCount}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{completedCount}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Completion</div>
          <div className="stat-value">
            {todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {/* Input Section */}
      <div className="input-section">
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a new todo..."
          aria-label="Add a new todo"
        />
        <button onClick={addTodo} aria-label="Add todo">
          Add
        </button>
      </div>

      {/* Filter Buttons */}
      <div className="filter-buttons">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
          aria-pressed={filter === 'all'}
        >
          All
        </button>
        <button 
          className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
          aria-pressed={filter === 'active'}
        >
          Active
        </button>
        <button 
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
          aria-pressed={filter === 'completed'}
        >
          Completed
        </button>
      </div>

      {/* Todo List */}
      <ul className="todo-list">
        {filteredTodos.length === 0 ? (
          <li className="empty-state">
            <h3>No todos found</h3>
            <p>{filter === 'all' ? 'Add your first task!' : `No ${filter} todos`}</p>
          </li>
        ) : (
          filteredTodos.map((todo) => (
            <li 
              key={todo.id} 
              id={`todo-${todo.id}`} 
              className={`todo-item ${todo.completed ? 'completed' : ''}`}
              role="group"
              aria-label={`Todo: ${todo.text}, ${todo.completed ? 'completed' : 'not completed'}`}
            >
              <div className="todo-content">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo.id)}
                  className="todo-checkbox"
                  aria-label={`Mark ${todo.text} as ${todo.completed ? 'incomplete' : 'complete'}`}
                />
                {editingId === todo.id ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    className="todo-text"
                    aria-label="Edit todo text"
                  />
                ) : (
                  <span 
                    className={`todo-text ${todo.completed ? 'completed' : ''}`}
                    role="textbox"
                    aria-readonly="true"
                  >
                    {todo.text}
                  </span>
                )}
              </div>
              <div className="todo-actions">
                {editingId === todo.id ? (
                  <>
                    <button 
                      className="todo-btn edit-btn" 
                      onClick={saveEdit}
                      aria-label="Save changes"
                    >
                      Save
                    </button>
                    <button 
                      className="todo-btn delete-btn" 
                      onClick={cancelEdit}
                      aria-label="Cancel editing"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      className="todo-btn edit-btn" 
                      onClick={() => startEditing(todo)}
                      aria-label="Edit todo"
                    >
                      Edit
                    </button>
                    <button 
                      className="todo-btn delete-btn" 
                      onClick={() => deleteTodo(todo.id)}
                      aria-label="Delete todo"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))
        )}
      </ul>

      {/* Footer Info */}
      {todos.length > 0 && (
        <div className="footer-info" style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)', marginTop: '24px', fontSize: '0.9rem' }}>
          <p>Double-click a todo to edit it • Press Enter to save • Escape to cancel</p>
        </div>
      )}
    </div>
  );
}

export default App;
