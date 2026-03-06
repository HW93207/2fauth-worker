import { ref } from 'vue'
import { ElMessage, ElNotification, ElMessageBox } from 'element-plus'
import { backupService } from '@/features/backup/service/backupService'
import { dataMigrationService } from '@/features/migration/service/dataMigrationService'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { i18n } from '@/locales'

export function useBackupActions(emit, fetchProviders) {
    const { t } = i18n.global
    const vaultStore = useVaultStore()

    // Backup Action State
    const showBackupDialog = ref(false)
    const backupPassword = ref('')
    const isBackingUp = ref(false)
    const useAutoPassword = ref(false)
    const currentActionProvider = ref(null)

    // Restore Action State
    const showRestoreListDialog = ref(false)
    const isLoadingFiles = ref(false)
    const backupFiles = ref([])
    const showRestoreConfirmDialog = ref(false)
    const restorePassword = ref('')
    const selectedFile = ref(null)
    const isRestoring = ref(false)

    // Backup methods
    const openBackupDialog = (provider) => {
        currentActionProvider.value = provider
        backupPassword.value = ''
        useAutoPassword.value = !!provider.auto_backup
        showBackupDialog.value = true
    }

    const handleBackup = async () => {
        if (!useAutoPassword.value && backupPassword.value.length < 12) {
            return ElMessage.warning(t('backup.password_min_length'))
        }

        const pwdToSend = useAutoPassword.value ? '' : backupPassword.value

        isBackingUp.value = true
        try {
            const res = await backupService.triggerBackup(currentActionProvider.value.id, pwdToSend)
            if (res.success) {
                ElNotification({
                    title: t('backup.backup_finish_title'),
                    message: `<div style="color:var(--el-color-success)">🎉 ${t('backup.backup_success_msg')}</div>`,
                    dangerouslyUseHTMLString: true,
                    type: 'success',
                    duration: 5000
                })
                showBackupDialog.value = false
                if (fetchProviders) await fetchProviders()
            }
        } catch (e) {
            // Already handled by request.js
        } finally { isBackingUp.value = false }
    }

    // Restore methods
    const openRestoreDialog = async (provider) => {
        currentActionProvider.value = provider
        showRestoreListDialog.value = true
        isLoadingFiles.value = true
        try {
            const res = await backupService.getBackupFiles(provider.id)
            if (res.success) backupFiles.value = res.files
        } catch (e) {
            // Error handled by request.js
        } finally { isLoadingFiles.value = false }
    }

    const selectRestoreFile = (file) => {
        selectedFile.value = file
        restorePassword.value = ''
        showRestoreConfirmDialog.value = true
    }

    const handleRestore = async () => {
        isRestoring.value = true
        try {
            const downloadRes = await backupService.downloadBackupFile(currentActionProvider.value.id, selectedFile.value.filename, true)

            let contentToDecrypt = downloadRes.content
            try {
                const json = typeof contentToDecrypt === 'string' ? JSON.parse(contentToDecrypt) : contentToDecrypt
                if (json && json.encrypted && json.data) {
                    contentToDecrypt = json.data
                }
            } catch (e) { }

            const vault = await dataMigrationService.parseImportData(contentToDecrypt, 'encrypted', restorePassword.value)
            const saveRes = await dataMigrationService.saveImportedVault(vault)

            if (saveRes.success) {
                let msgHtml = `<div>${t('backup.processed_total')} <b>1</b> ${t('backup.backup_files_count')} (${vault.length} ${t('backup.base_accounts_count')})。</div>`
                if (saveRes.count > 0) {
                    msgHtml += `<div style="color:var(--el-color-success)">🎉 ${t('backup.import_success_count')} <b>${saveRes.count}</b> ${t('backup.new_accounts')}</div>`
                } else {
                    msgHtml += `<div style="color:var(--el-color-warning)">⚠️ ${t('backup.no_new_accounts')}</div>`
                }
                if (saveRes.duplicates > 0) msgHtml += `<div style="color:var(--el-text-color-secondary)">ℹ️ ${t('backup.skipped_duplicates')} <b>${saveRes.duplicates}</b> ${t('backup.existing_accounts')}</div>`

                ElNotification({
                    title: t('backup.restore_finish_title'),
                    message: msgHtml,
                    dangerouslyUseHTMLString: true,
                    type: 'success',
                    duration: 8000
                })

                showRestoreConfirmDialog.value = false
                showRestoreListDialog.value = false
                if (saveRes.count > 0) {
                    vaultStore.markDirty()
                    emit('restore-success')
                }
            }
        } catch (e) {
            // Check if the backend told us the file was unavailable/deleted on Telegram
            if (e.message?.includes('FILE_UNAVAILABLE')) {
                // Close the password prompt, but keep the restore list dialog open
                showRestoreConfirmDialog.value = false

                ElMessageBox.confirm(
                    t('backup.file_unavailable'),
                    t('backup.record_invalid'),
                    {
                        confirmButtonText: t('backup.confirm_clean'),
                        cancelButtonText: t('backup.cancel_clean'),
                        type: 'warning'
                    }
                ).then(async () => {
                    try {
                        await backupService.deleteBackupFile(currentActionProvider.value.id, selectedFile.value.filename)
                        if (selectedFile.value) {
                            backupFiles.value = backupFiles.value.filter(f => f.filename !== selectedFile.value.filename)
                        }
                        ElMessage.success(t('backup.clean_record_success'))
                    } catch (err) {
                        ElMessage.error(err.message || t('backup.clean_record_fail'))
                    }
                }).catch(() => { })
            } else if (!e.message?.includes('connection_failed')) {
                // Keep local toast for decryption errors that don't originate from fetch
                ElMessage.error(e.message || t('backup.restore_fail'))
            }
        } finally { isRestoring.value = false }
    }

    return {
        // Backup
        showBackupDialog,
        backupPassword,
        isBackingUp,
        useAutoPassword,
        currentActionProvider,
        openBackupDialog,
        handleBackup,

        // Restore
        showRestoreListDialog,
        isLoadingFiles,
        backupFiles,
        showRestoreConfirmDialog,
        restorePassword,
        selectedFile,
        isRestoring,
        openRestoreDialog,
        selectRestoreFile,
        handleRestore
    }
}
