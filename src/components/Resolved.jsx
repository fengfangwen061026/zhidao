import { forwardRef } from 'react';
import { useResolvedFileUrl } from '../hooks/useResolvedFileUrl';

export function ResolvedImg({ src, ...props }) {
  const resolvedSrc = useResolvedFileUrl(src);
  return <img src={resolvedSrc} {...props} />;
}

export const ResolvedVideo = forwardRef(function ResolvedVideo({ src, poster, ...props }, ref) {
  const resolvedSrc = useResolvedFileUrl(src);
  const resolvedPoster = useResolvedFileUrl(poster);
  return <video ref={ref} src={resolvedSrc} poster={resolvedPoster} {...props} />;
});

export function ResolvedIframe({ src, ...props }) {
  const resolvedSrc = useResolvedFileUrl(src);
  return <iframe src={resolvedSrc} {...props} />;
}

export function ResolvedLink({ href, ...props }) {
  const resolvedHref = useResolvedFileUrl(href);
  return <a href={resolvedHref} {...props} />;
}

