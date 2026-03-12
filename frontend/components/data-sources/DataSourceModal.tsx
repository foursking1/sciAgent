'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Database, Plus, Trash2, Edit2, Check, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dataSourcesApi, type DataSource, type DataSourceCreate } from '@/lib/api'

interface DataSourceModalProps {
  isOpen: boolean
  onClose: () => void
  token: string
}

type DataSourceType = 'database' | 'vector_store' | 'skill'

const DATA_SOURCE_TYPES: { type: DataSourceType; label: string; description: string; icon: typeof Database }[] = [
  { type: 'database', label: '数据库', description: 'MySQL, PostgreSQL 等', icon: Database },
  { type: 'vector_store', label: '向量库', description: 'Pinecone, Milvus 等', icon: Database },
  { type: 'skill', label: 'Skills', description: '自定义数据访问技能', icon: Database },
]

/**
 * DataSourceModal - Modal for managing data sources
 */
export function DataSourceModal({ isOpen, onClose, token }: DataSourceModalProps) {
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingSource, setEditingSource] = useState<DataSource | null>(null)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; message: string } | null>(null)

  // Load data sources
  const loadDataSources = useCallback(async () => {
    if (!token) return

    try {
      setIsLoading(true)
      setError(null)
      const data = await dataSourcesApi.list(token)
      setDataSources(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data sources')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (isOpen) {
      loadDataSources()
    }
  }, [isOpen, loadDataSources])

  // Handle delete
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个数据源吗？')) return

    try {
      await dataSourcesApi.delete(token, id)
      setDataSources(prev => prev.filter(ds => ds.id !== id))
    } catch (err) {
      alert('删除失败: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  // Handle test connection
  const handleTest = async (id: number) => {
    try {
      setTestingId(id)
      setTestResult(null)
      const result = await dataSourcesApi.test(token, id)
      setTestResult({ id, success: result.success, message: result.message })
    } catch (err) {
      setTestResult({ id, success: false, message: err instanceof Error ? err.message : 'Test failed' })
    } finally {
      setTestingId(null)
    }
  }

  // Handle form success
  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingSource(null)
    loadDataSources()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col',
          'bg-surface-200 border border-gray-700 rounded-2xl shadow-2xl',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-white">数据源 Market</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showForm || editingSource ? (
            <DataSourceForm
              token={token}
              editingSource={editingSource}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setShowForm(false)
                setEditingSource(null)
              }}
            />
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                </div>
              ) : dataSources.length === 0 ? (
                <EmptyState onAdd={() => setShowForm(true)} />
              ) : (
                <>
                  {/* Add button */}
                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-primary-500 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>添加数据源</span>
                  </button>

                  {/* Data source list */}
                  <div className="space-y-3">
                    {dataSources.map(ds => (
                      <DataSourceCard
                        key={ds.id}
                        dataSource={ds}
                        onEdit={() => setEditingSource(ds)}
                        onDelete={() => handleDelete(ds.id)}
                        onTest={() => handleTest(ds.id)}
                        isTesting={testingId === ds.id}
                        testResult={testResult?.id === ds.id ? testResult : null}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

// Empty state component
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-12">
      <Database className="w-12 h-12 text-gray-600 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-300 mb-2">暂无数据源</h3>
      <p className="text-sm text-gray-500 mb-6">
        添加数据源后，Agent 可以在问答时自动引用这些数据
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>添加数据源</span>
      </button>

      {/* Data source types hint */}
      <div className="grid grid-cols-3 gap-4 mt-8">
        {DATA_SOURCE_TYPES.map(({ type, label, description, icon: Icon }) => (
          <div
            key={type}
            className="p-4 rounded-lg border border-gray-700 hover:border-primary-500/50 cursor-pointer transition-colors"
            onClick={onAdd}
          >
            <Icon className="w-6 h-6 text-primary-400 mb-2" />
            <h4 className="font-medium text-gray-200">{label}</h4>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Data source card component
function DataSourceCard({
  dataSource,
  onEdit,
  onDelete,
  onTest,
  isTesting,
  testResult
}: {
  dataSource: DataSource
  onEdit: () => void
  onDelete: () => void
  onTest: () => void
  isTesting: boolean
  testResult: { success: boolean; message: string } | null
}) {
  const typeInfo = DATA_SOURCE_TYPES.find(t => t.type === dataSource.type)

  return (
    <div className="p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            dataSource.type === 'database' && 'bg-primary-500/20 text-primary-400',
            dataSource.type === 'vector_store' && 'bg-accent-500/20 text-accent-400',
            dataSource.type === 'skill' && 'bg-emerald-500/20 text-emerald-400'
          )}>
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-medium text-gray-100">{dataSource.name}</h4>
            <p className="text-sm text-gray-500">{typeInfo?.label || dataSource.type}</p>
            {dataSource.description && (
              <p className="text-xs text-gray-600 mt-1">{dataSource.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Status badge */}
          <span className={cn(
            'px-2 py-0.5 rounded text-xs',
            dataSource.is_active
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-gray-500/20 text-gray-400'
          )}>
            {dataSource.is_active ? '活跃' : '停用'}
          </span>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={cn(
          'mt-3 p-2 rounded text-xs flex items-center gap-2',
          testResult.success
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-red-500/10 text-red-400'
        )}>
          {testResult.success ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
          {testResult.message}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onTest}
          disabled={isTesting}
          className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {isTesting ? (
            <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
          ) : null}
          测试连接
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <Edit2 className="w-3 h-3 inline mr-1" />
          编辑
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1 rounded text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3 h-3 inline mr-1" />
          删除
        </button>
      </div>
    </div>
  )
}

// Data source form component
function DataSourceForm({
  token,
  editingSource,
  onSuccess,
  onCancel
}: {
  token: string
  editingSource: DataSource | null
  onSuccess: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(editingSource?.name || '')
  const [type, setType] = useState<DataSourceType>(editingSource?.type || 'database')
  const [description, setDescription] = useState(editingSource?.description || '')
  const [config, setConfig] = useState<string>(
    editingSource ? JSON.stringify(editingSource.config, null, 2) : '{}'
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate JSON config
    let parsedConfig: Record<string, unknown>
    try {
      parsedConfig = JSON.parse(config)
    } catch {
      setError('配置必须是有效的 JSON 格式')
      return
    }

    if (!name.trim()) {
      setError('名称不能为空')
      return
    }

    try {
      setIsSubmitting(true)

      if (editingSource) {
        await dataSourcesApi.update(token, editingSource.id, {
          name: name.trim(),
          config: parsedConfig,
          description: description.trim() || undefined,
        })
      } else {
        const data: DataSourceCreate = {
          name: name.trim(),
          type,
          config: parsedConfig,
          description: description.trim() || undefined,
        }
        await dataSourcesApi.create(token, data)
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-surface border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
          placeholder="例如：生产环境数据库"
        />
      </div>

      {/* Type */}
      {!editingSource && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">类型</label>
          <div className="grid grid-cols-3 gap-2">
            {DATA_SOURCE_TYPES.map(({ type: t, label }) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'px-3 py-2 rounded-lg border text-sm transition-colors',
                  type === t
                    ? 'border-primary-500 bg-primary-500/20 text-primary-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">描述（可选）</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-surface border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
          placeholder="数据源用途说明"
        />
      </div>

      {/* Config JSON */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">配置（JSON）</label>
        <textarea
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 rounded-lg bg-surface border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 font-mono text-sm"
          placeholder='{"host": "localhost", "port": 5432}'
        />
        <p className="text-xs text-gray-500 mt-1">
          {type === 'database' && '示例: {"host": "localhost", "port": 5432, "database": "mydb"}'}
          {type === 'vector_store' && '示例: {"collection": "documents", "embedding_model": "text-embedding-3-small"}'}
          {type === 'skill' && '示例: {"skill_name": "weather_api", "endpoint": "https://api.example.com"}'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"
        >
          {isSubmitting ? '保存中...' : editingSource ? '更新' : '创建'}
        </button>
      </div>
    </form>
  )
}

export default DataSourceModal
