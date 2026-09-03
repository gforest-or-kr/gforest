output "service_name" { value = aws_ecs_service.app.name }
output "task_family" { value = aws_ecs_task_definition.app.family }
output "log_group" { value = aws_cloudwatch_log_group.app.name }
output "alb_dns_name" { value = local.shared.alb_dns_name }
