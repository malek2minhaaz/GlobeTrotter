import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { queryKeys } from '@/lib/queryClient';
import { toast } from '@/lib/toast';
import { discoveryService } from '@/services/discovery.service';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Bookmarking a destination (Section 24).
 *
 * Saving requires an account, so a signed-out visitor is sent to login with a
 * return path rather than shown a button that silently fails.
 */
export function useSavedCity() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['saved'] });
    void queryClient.invalidateQueries({ queryKey: ['cities'] });
    void queryClient.invalidateQueries({ queryKey: ['city'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  };

  const save = useMutation({
    mutationFn: (cityId: string) => discoveryService.save(cityId),
    onSuccess: () => {
      invalidate();
      toast.success('Saved to your destinations');
    },
    onError: (error) => toast.fromError(error, 'We could not save that destination.'),
  });

  const unsave = useMutation({
    mutationFn: (cityId: string) => discoveryService.unsave(cityId),
    onSuccess: () => {
      invalidate();
      toast.info('Removed from saved destinations');
    },
    onError: (error) => toast.fromError(error, 'We could not remove that destination.'),
  });

  const toggle = (cityId: string, currentlySaved: boolean) => {
    if (!isAuthenticated) {
      toast.info('Sign in to save destinations');
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (currentlySaved) unsave.mutate(cityId);
    else save.mutate(cityId);
  };

  return { toggle, save, unsave, isPending: save.isPending || unsave.isPending };
}
